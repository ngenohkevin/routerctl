'use client';

import { useState } from 'react';
import { Zap } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import type { Device } from '@/types';

interface PriorityDialogProps {
  device: Device | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSetPriority: (priority: number) => Promise<void>;
  onRemovePriority: () => Promise<void>;
}

const priorityLabels: Record<number, string> = {
  1: 'Highest (Gaming/Video)',
  2: 'Very High',
  3: 'High',
  4: 'Above Normal',
  5: 'Normal',
  6: 'Below Normal',
  7: 'Low',
  8: 'Lowest (Background)',
};

export function PriorityDialog({
  device,
  open,
  onOpenChange,
  onSetPriority,
  onRemovePriority,
}: PriorityDialogProps) {
  const [priority, setPriority] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const handleSetPriority = async () => {
    setIsLoading(true);
    try {
      await onSetPriority(priority);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemovePriority = async () => {
    setIsLoading(true);
    try {
      await onRemovePriority();
    } finally {
      setIsLoading(false);
    }
  };

  if (!device) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Boost Priority
          </DialogTitle>
          <DialogDescription>
            Set network priority for {device.hostname || device.ip}. Lower numbers mean higher priority.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="grid gap-4">
            <div className="flex justify-between items-center">
              <Label>Priority Level</Label>
              <span className="text-sm font-medium">{priority}</span>
            </div>
            <Slider
              value={[priority]}
              onValueChange={([value]) => setPriority(value)}
              min={1}
              max={8}
              step={1}
              className="w-full"
            />
            <p className="text-sm text-muted-foreground text-center">
              {priorityLabels[priority]}
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((p) => (
              <Button
                key={p}
                variant={priority === p ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPriority(p)}
                className="w-full"
              >
                {p}
              </Button>
            ))}
          </div>
        </div>
        <DialogFooter className="flex gap-2 sm:justify-between">
          <Button
            variant="outline"
            onClick={handleRemovePriority}
            disabled={isLoading}
          >
            Remove Priority
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSetPriority} disabled={isLoading}>
              {isLoading ? 'Setting...' : 'Set Priority'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
