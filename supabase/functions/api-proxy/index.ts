import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/mysql@v2.12.1/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// deno-lint-ignore no-explicit-any
type RowData = any;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let client: Client | null = null;

  try {
    const databaseUrl = Deno.env.get('DATABASE_URL');
    
    if (!databaseUrl) {
      throw new Error('DATABASE_URL not configured');
    }

    const reqUrl = new URL(req.url);
    const action = reqUrl.searchParams.get('action');

    console.log('Action requested:', action);
    console.log('Connecting to MySQL database...');

    // Parse MySQL connection string
    const dbUrl = new URL(databaseUrl);
    const hostname = dbUrl.hostname;
    const port = parseInt(dbUrl.port) || 3306;
    const username = dbUrl.username;
    const password = dbUrl.password;
    const database = dbUrl.pathname.slice(1);

    console.log(`Connecting to ${hostname}:${port}/${database}`);

    client = await new Client().connect({
      hostname,
      port,
      username,
      password,
      db: database,
    });

    console.log('Connected to MySQL successfully');

    // List tables action
    if (action === 'list-tables') {
      const tables = await client.query('SHOW TABLES');
      console.log('Tables found:', JSON.stringify(tables));
      await client.close();
      return new Response(JSON.stringify({ tables }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Describe table action
    if (action === 'describe') {
      const tableName = reqUrl.searchParams.get('table') || 'Registration';
      const columns = await client.query(`DESCRIBE ${tableName}`);
      console.log('Columns:', JSON.stringify(columns));
      await client.close();
      return new Response(JSON.stringify({ columns }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // First, fetch all districts and churches for mapping
    const districtsResult = await client.query('SELECT id, name FROM District');
    const churchesResult = await client.query('SELECT id, name FROM Church');

    // Create lookup maps
    const districtMap = new Map<string, string>();
    const churchMap = new Map<string, string>();

    (districtsResult as RowData[]).forEach((d) => {
      districtMap.set(d.id, d.name);
    });

    (churchesResult as RowData[]).forEach((c) => {
      churchMap.set(c.id, c.name);
    });

    console.log(`Loaded ${districtMap.size} districts and ${churchMap.size} churches`);

    // Fetch registrations - incluindo photoUrl explicitamente
    const result = await client.query(
      `SELECT id, fullName, birthDate, ageYears, districtId, churchId, photoUrl, status, createdAt 
       FROM Registration 
       WHERE status = 'PAID'
       ORDER BY createdAt ASC 
       LIMIT 5000`
    );

    console.log('Query executed, rows:', result.length);

    // Base URL para as fotos
    const FOTO_BASE_URL = 'https://ipitinga.ideartcloud.com.br/uploads/';

    // Format the response with mapped names
    const inscritos = (result as RowData[]).map((row) => {
      // Processar photoUrl - pode ser string, null, ou undefined
      let fotoUrl: string | null = null;
      if (row.photoUrl) {
        const photo = String(row.photoUrl).trim();
        if (photo.length > 0 && photo !== 'null' && photo !== 'undefined') {
          // Extrair apenas o nome do arquivo da URL antiga ou usar diretamente se for só o nome
          let filename = photo;
          
          // Se for uma URL completa, extrair o nome do arquivo
          if (photo.includes('/uploads/')) {
            const parts = photo.split('/uploads/');
            filename = parts[parts.length - 1];
          } else if (photo.startsWith('http')) {
            // Se for outra URL, pegar a última parte
            const urlParts = photo.split('/');
            filename = urlParts[urlParts.length - 1];
          }
          
          // Construir a nova URL
          fotoUrl = `${FOTO_BASE_URL}${filename}`;
        }
      }

      return {
        numero: row.id,
        nome: row.fullName || 'Sem nome',
        dataNascimento: row.birthDate 
          ? (row.birthDate instanceof Date 
              ? row.birthDate.toISOString().split('T')[0]
              : String(row.birthDate).split('T')[0])
          : null,
        idade: row.ageYears || 0,
        igreja: churchMap.get(row.churchId) || 'Não informado',
        distrito: districtMap.get(row.districtId) || 'Não informado',
        fotoUrl: fotoUrl,
        status: row.status,
        createdAt: row.createdAt instanceof Date 
          ? row.createdAt.toISOString()
          : String(row.createdAt),
      };
    });

    const response = {
      page: 1,
      limit: 5000,
      total: inscritos.length,
      totalPages: 1,
      inscritos,
    };

    console.log('Successfully fetched', inscritos.length, 'inscritos');

    await client.close();

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Database error:', error);
    
    if (client) {
      try {
        await client.close();
      } catch (closeError) {
        console.error('Error closing connection:', closeError);
      }
    }

    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Failed to fetch from MySQL database'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
