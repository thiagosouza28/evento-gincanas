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
    const actionFromQuery = reqUrl.searchParams.get('action');
    let body: Record<string, unknown> | null = null;
    if (req.method !== 'GET') {
      try {
        body = await req.json();
      } catch {
        body = null;
      }
    }
    const action = actionFromQuery || (body?.action as string | undefined);
    const requestedEventId = (body?.eventId as string | undefined)
      || reqUrl.searchParams.get('eventId')
      || reqUrl.searchParams.get('event_id')
      || undefined;

    const requestedStatusesRaw = (body?.statuses as unknown)
      || reqUrl.searchParams.get('statuses')
      || reqUrl.searchParams.get('status');

    const normalizeStatuses = (value: unknown): string[] => {
      if (!value) return [];
      if (Array.isArray(value)) {
        return value.map((v) => String(v));
      }
      if (typeof value === 'string') {
        return value.split(',').map((v) => v.trim()).filter(Boolean);
      }
      return [];
    };

    const requestedStatuses = normalizeStatuses(requestedStatusesRaw).map((s) => s.toUpperCase());

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

    // Eventos action
    if (action === 'events') {
      const tablesResult = await client.query('SHOW TABLES');
      const tableNames = (tablesResult as RowData[]).map((row) => String(Object.values(row)[0] || ''));
      const lowerNames = new Set(tableNames.map((name) => name.toLowerCase()));
      const candidates = ['event', 'events', 'evento', 'eventos'];
      const matched = candidates.find((candidate) => lowerNames.has(candidate));
      const tableName = matched ? tableNames.find((name) => name.toLowerCase() === matched) : null;

      if (!tableName) {
        await client.close();
        return new Response(JSON.stringify({ events: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      const columns = await client.query(`DESCRIBE ${tableName}`);
      const columnList = (columns as RowData[]).map((col) => String(col.Field ?? col.field ?? col.COLUMN_NAME ?? col.column_name ?? '')).filter(Boolean);
      const columnNames = new Set(columnList);
      const columnMap = new Map<string, string>();
      columnList.forEach((name) => columnMap.set(name.toLowerCase(), name));

      const idCandidates = ['id', 'event_id', 'evento_id'];
      const nameCandidates = ['name', 'nome', 'title', 'titulo', 'descricao', 'description'];

      const idColumn = idCandidates
        .map((candidate) => columnMap.get(candidate.toLowerCase()))
        .find(Boolean)
        || Array.from(columnNames)[0]
        || 'id';
      const nameColumn = nameCandidates
        .map((candidate) => columnMap.get(candidate.toLowerCase()))
        .find(Boolean)
        || idColumn;

      const events = await client.query(
        `SELECT \`${idColumn}\` AS id, \`${nameColumn}\` AS name FROM \`${tableName}\` ORDER BY \`${nameColumn}\` ASC LIMIT 5000`
      );

      await client.close();
      return new Response(JSON.stringify({ events }), {
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

    let eventColumn: string | null = null;
    if (requestedEventId) {
      const columns = await client.query('DESCRIBE Registration');
      const columnList = (columns as RowData[]).map((col) => String(col.Field ?? col.field ?? col.COLUMN_NAME ?? col.column_name ?? '')).filter(Boolean);
      const columnMap = new Map<string, string>();
      columnList.forEach((name) => columnMap.set(name.toLowerCase(), name));
      const candidates = ['eventid', 'event_id', 'evento_id', 'eventoid'];
      eventColumn = candidates.map((candidate) => columnMap.get(candidate)).find(Boolean) || null;
      if (!eventColumn) {
        console.warn('Event column not found in Registration table, ignoring event filter.');
      }
    }

    const whereClauses: string[] = [];
    const params: unknown[] = [];
    if (eventColumn && requestedEventId) {
      whereClauses.push(`r.\`${eventColumn}\` = ?`);
      params.push(requestedEventId);
    }

    const requestedSet = new Set(requestedStatuses);
    const hasAllSelected =
      requestedSet.size === 0 ||
      requestedSet.has('ALL') ||
      (requestedSet.has('PAID') && requestedSet.has('PENDING') && requestedSet.has('CANCELLED'));

    if (!hasAllSelected) {
      const statusMap: Record<string, string[]> = {
        PAID: ['PAID', 'APPROVED', 'PAGO', 'CONFIRMED', 'CONFIRMADO'],
        PENDING: ['PENDING', 'PENDENTE', 'AGUARDANDO', 'EM ABERTO', 'AWAITING'],
        CANCELLED: ['CANCELLED', 'CANCELED', 'CANCELADO', 'CANCELADA', 'REFUNDED', 'REEMBOLSADO'],
      };

      const statusSet = new Set<string>();
      for (const status of requestedStatuses) {
        const mapped = statusMap[status];
        if (mapped) {
          mapped.forEach((item) => statusSet.add(item));
        }
      }

      if (statusSet.size > 0) {
        const statusValues = Array.from(statusSet);
        const placeholders = statusValues.map(() => '?').join(',');
        whereClauses.push(`UPPER(r.status) IN (${placeholders})`);
        params.push(...statusValues);
      }
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Fetch registrations - incluindo photoUrl explicitamente
    const result = await client.query(
      `SELECT r.id, r.fullName, r.birthDate, r.ageYears, r.districtId, r.churchId, r.photoUrl, r.status, r.createdAt,
              o.pricingLotId AS lotId, el.name AS lotName, el.startsAt AS lotStartsAt, el.endsAt AS lotEndsAt
       FROM Registration r
       LEFT JOIN \`Order\` o ON o.id = r.orderId
       LEFT JOIN EventLot el ON el.id = o.pricingLotId
       ${whereSql}
       ORDER BY r.createdAt ASC
       LIMIT 5000`,
      params
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
        loteId: row.lotId || null,
        loteNome: row.lotName || null,
        loteInicio: row.lotStartsAt
          ? (row.lotStartsAt instanceof Date
              ? row.lotStartsAt.toISOString()
              : String(row.lotStartsAt))
          : null,
        loteFim: row.lotEndsAt
          ? (row.lotEndsAt instanceof Date
              ? row.lotEndsAt.toISOString()
              : String(row.lotEndsAt))
          : null,
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
