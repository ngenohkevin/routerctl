'use client';

import { useState } from 'react';
import { Plus, Clock, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface SchedulerDialogProps {
  onSchedule: (name: string, startTime: string, interval: string) => Promise<void>;
}

const INTERVAL_OPTIONS = [
  { value: '1d', label: 'Daily' },
  { value: '7d', label: 'Weekly' },
  { value: '30d', label: 'Monthly' },
  { value: '', label: 'Once (no repeat)' },
];

export function SchedulerDialog({ onSchedule }: SchedulerDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState('');
  const [time, setTime] = useState('03:00');
  const [interval, setInterval] = useState('1d');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !time) return;

    setIsLoading(true);
    try {
      // Convert HH:MM to HH:MM:SS format
      const startTime = `${time}:00`;
      await onSchedule(name.trim(), startTime, interval);
      setOpen(false);
      // Reset form
      setName('');
      setTime('03:00');
      setInterval('1d');
    } catch (error) {
      // Error handling is done in the parent component
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Schedule Reboot
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Schedule Reboot
            </DialogTitle>
            <DialogDescription>
              Schedule automatic router reboots. The router will restart at the
              specified time.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Task Name</Label>
              <Input
                id="name"
                placeholder="e.g., daily-reboot"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="time">Reboot Time</Label>
              <Input
                id="time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Time in 24-hour format (router local time)
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="interval">Repeat</Label>
              <Select value={interval} onValueChange={setInterval}>
                <SelectTrigger>
                  <SelectValue placeholder="Select interval" />
                </SelectTrigger>
                <SelectContent>
                  {INTERVAL_OPTIONS.map((option) => (
                    <SelectItem key={option.value || 'once'} value={option.value || 'once'}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !name.trim()}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Scheduling...
                </>
              ) : (
                'Create Schedule'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
