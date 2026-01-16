'use client';

import { useState } from 'react';
import { Power, AlertTriangle, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

interface RebootDialogProps {
  onReboot: () => Promise<void>;
  disabled?: boolean;
}

export function RebootDialog({ onReboot, disabled }: RebootDialogProps) {
  const [open, setOpen] = useState(false);
  const [isRebooting, setIsRebooting] = useState(false);

  const handleReboot = async () => {
    setIsRebooting(true);
    try {
      await onReboot();
      setOpen(false);
    } catch (error) {
      // Error handling is done in the parent component
    } finally {
      setIsRebooting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm" className="h-8 px-2 sm:px-3" disabled={disabled}>
          <Power className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Reboot</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Reboot Router?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              This will immediately restart your router. All network connections
              will be temporarily interrupted.
            </p>
            <p className="text-destructive font-medium">
              The router will be offline for approximately 30-60 seconds.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isRebooting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleReboot}
            disabled={isRebooting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isRebooting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Rebooting...
              </>
            ) : (
              <>
                <Power className="h-4 w-4 mr-2" />
                Reboot Now
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
