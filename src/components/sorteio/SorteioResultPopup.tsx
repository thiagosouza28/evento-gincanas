import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CheckCircle2, User } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Inscrito, Equipe } from '@/types';

interface SorteioResultPopupProps {
  open: boolean;
  onClose: () => void;
  inscrito: Inscrito | null;
  equipe: Equipe | null;
}

export function SorteioResultPopup({ open, onClose, inscrito, equipe }: SorteioResultPopupProps) {
  if (!inscrito || !equipe) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col items-center justify-center bg-background border-none p-12">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="text-center"
        >
          <div className="relative inline-block">
            <img
              src={inscrito.fotoUrl || '/placeholder.svg'}
              alt={inscrito.nome}
              className="mx-auto mb-4 h-40 w-40 rounded-2xl object-cover border-4 border-primary shadow-xl"
              onError={(e) => {
                e.currentTarget.src = '/placeholder.svg';
              }}
            />
            <div className="absolute -bottom-2 -right-2 bg-success text-success-foreground rounded-full p-2 shadow-lg">
              <CheckCircle2 className="h-8 w-8" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center space-y-4"
        >
          <p className="text-2xl text-muted-foreground">Inscrito Nº {inscrito.numero}</p>
          <h2 className="text-display-md font-bold text-foreground">{inscrito.nome}</h2>
          <p className="text-xl text-muted-foreground">
            {inscrito.igreja} • {inscrito.distrito}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, type: "spring" }}
          className="mt-12 text-center"
        >
          <p className="text-lg text-muted-foreground mb-4">Foi sorteado para a equipe</p>
          <div
            className="rounded-2xl px-16 py-8"
            style={{
              backgroundColor: `${equipe.corPulseira || `hsl(var(--team-${equipe.cor}))`}20`,
              border: `3px solid ${equipe.corPulseira || `hsl(var(--team-${equipe.cor}))`}`,
              boxShadow: `0 0 60px ${equipe.corPulseira || `hsl(var(--team-${equipe.cor}))`}66`
            }}
          >
            <h1
              className="text-display-lg font-bold"
              style={{ color: equipe.corPulseira || `hsl(var(--team-${equipe.cor}))` }}
            >
              {equipe.nome}
            </h1>
            <p className="mt-2 text-lg text-muted-foreground">
              Líder: {equipe.lider} | Vice: {equipe.vice}
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-12"
        >
          <Button onClick={onClose} size="lg" className="px-12">
            Próximo Sorteio
          </Button>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
