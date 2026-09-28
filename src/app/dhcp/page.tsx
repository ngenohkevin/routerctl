'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  RefreshCw,
  Search,
  Plus,
  Pin,
  Trash2,
  Edit,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Power,
  PowerOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AppShell } from '@/components/shell/app-shell';
import { PageHeader } from '@/components/shell/page-header';
import { Stat, StatStrip } from '@/components/shell/stat';
import { api, isAuthenticated } from '@/lib/api';
import { toast } from 'sonner';
import type { DHCPLease } from '@/types';

export default function DHCPPage() {
  const router = useRouter();
  const [leases, setLeases] = useState<DHCPLease[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Dialogs
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedLease, setSelectedLease] = useState<DHCPLease | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    mac: '',
    address: '',
    hostname: '',
    comment: '',
  });

  // Check authentication
  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
    }
  }, [router]);

  const fetchData = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setIsRefreshing(true);
    try {
      const leasesRes = await api.getDHCPLeases().catch(() => ({ leases: [], count: 0 }));
      setLeases(leasesRes.leases || []);
    } catch {
      toast.error('Failed to fetch DHCP leases');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter leases by search query
  const filteredLeases = useMemo(() => {
    if (!searchQuery.trim()) return leases;
    const query = searchQuery.toLowerCase();
    return leases.filter(
      (lease) =>
        lease.mac.toLowerCase().includes(query) ||
        lease.address.toLowerCase().includes(query) ||
        lease.hostname?.toLowerCase().includes(query) ||
        lease.comment?.toLowerCase().includes(query)
    );
  }, [leases, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    const staticCount = leases.filter((l) => !l.dynamic).length;
    const dynamicCount = leases.filter((l) => l.dynamic).length;
    const activeCount = leases.filter((l) => l.status === 'bound').length;
    return {
      total: leases.length,
      static: staticCount,
      dynamic: dynamicCount,
      active: activeCount,
    };
  }, [leases]);

  // Handlers
  const handleMakeStatic = async (mac: string) => {
    try {
      await api.makeLeaseStatic(mac);
      toast.success('Lease converted to static');
      fetchData(false);
    } catch {
      toast.error('Failed to make lease static');
    }
  };

  const handleDelete = async () => {
    if (!selectedLease) return;
    try {
      await api.deleteLease(selectedLease.mac);
      toast.success('Lease deleted');
      setDeleteDialogOpen(false);
      setSelectedLease(null);
      fetchData(false);
    } catch {
      toast.error('Failed to delete lease');
    }
  };

  const handleCreate = async () => {
    if (!formData.mac || !formData.address) {
      toast.error('MAC and IP address are required');
      return;
    }
    try {
      await api.createStaticLease({
        mac: formData.mac,
        address: formData.address,
        hostname: formData.hostname || undefined,
        comment: formData.comment || undefined,
      });
      toast.success('Static lease created');
      setAddDialogOpen(false);
      setFormData({ mac: '', address: '', hostname: '', comment: '' });
      fetchData(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create lease');
    }
  };

  const handleUpdate = async () => {
    if (!selectedLease) return;
    if (!formData.hostname && !formData.comment) {
      toast.error('Hostname or comment is required');
      return;
    }
    try {
      await api.updateLease(selectedLease.mac, {
        hostname: formData.hostname || undefined,
        comment: formData.comment || undefined,
      });
      toast.success('Lease updated');
      setEditDialogOpen(false);
      setSelectedLease(null);
      setFormData({ mac: '', address: '', hostname: '', comment: '' });
      fetchData(false);
    } catch {
      toast.error('Failed to update lease');
    }
  };

  const handleToggleDisabled = async (lease: DHCPLease) => {
    try {
      if (lease.disabled) {
        await api.enableLease(lease.mac);
        toast.success('Lease enabled');
      } else {
        await api.disableLease(lease.mac);
        toast.success('Lease disabled');
      }
      fetchData(false);
    } catch {
      toast.error('Failed to toggle lease status');
    }
  };

  const openEditDialog = (lease: DHCPLease) => {
    setSelectedLease(lease);
    setFormData({
      mac: lease.mac,
      address: lease.address,
      hostname: lease.hostname || '',
      comment: lease.comment || '',
    });
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (lease: DHCPLease) => {
    setSelectedLease(lease);
    setDeleteDialogOpen(true);
  };

  // One actions menu for both the phone list and the desktop table.
  const renderLeaseActions = (lease: DHCPLease) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-9 text-ink-3" aria-label={`Actions for ${lease.address}`}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {lease.dynamic && (
          <DropdownMenuItem onClick={() => handleMakeStatic(lease.mac)}>
            <Pin className="h-4 w-4 mr-2" />
            Make Static
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => openEditDialog(lease)}>
          <Edit className="h-4 w-4 mr-2" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleToggleDisabled(lease)}>
          {lease.disabled ? (
            <>
              <Power className="h-4 w-4 mr-2" />
              Enable
            </>
          ) : (
            <>
              <PowerOff className="h-4 w-4 mr-2" />
              Disable
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive"
          onClick={() => openDeleteDialog(lease)}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>  );

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="DHCP leases"
          description="Every address the router has handed out — pin one to keep a device on the same IP."
          actions={
            <Button variant="outline" size="sm" className="h-9 gap-2" onClick={() => fetchData()} disabled={isRefreshing}>
              <RefreshCw className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          }
        />

        <StatStrip>
          <Stat label="Leases" value={stats.total} />
          <Stat label="Pinned" value={stats.static} tone="air" icon={<Pin className="size-3" />} />
          <Stat label="Dynamic" value={stats.dynamic} />
          <Stat label="Active" value={stats.active} tone="link" />
        </StatStrip>

        {/* Search and Add */}
        <Card className="py-3 md:py-3">
          <CardContent>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by MAC, IP, or hostname..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Static Lease
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Leases — stacked list on phones (actions within reach), table from md */}
        <Card className="py-0 md:py-0">
          <CardContent className="p-0 md:p-0">
            <ul className="divide-y divide-hairline-soft md:hidden">
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <li key={i} className="space-y-2 px-4 py-3.5">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-2/3" />
                  </li>
                ))
              ) : filteredLeases.length === 0 ? (
                <li className="px-4 py-10 text-center text-sm text-ink-3">No leases found</li>
              ) : (
                filteredLeases.map((lease) => (
                  <li key={lease.id} className={`flex items-start gap-3 px-4 py-3.5 ${lease.disabled ? 'opacity-50' : ''}`}>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[15px] font-medium text-ink">
                        {lease.comment || lease.hostname || 'Unnamed device'}
                      </div>
                      <div className="num mt-0.5 font-mono text-[13px] text-ink-2">{lease.address}</div>
                      <div className="mt-0.5 truncate font-mono text-[11px] text-ink-4">{lease.mac}</div>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-medium">
                        <span className={`rounded-md border px-1.5 py-0.5 ${lease.dynamic ? 'border-hairline-strong text-ink-3' : 'border-air/30 text-air'}`}>
                          {lease.dynamic ? 'Dynamic' : 'Pinned'}
                        </span>
                        <span
                          className={`rounded-md border px-1.5 py-0.5 ${
                            lease.disabled
                              ? 'border-fault/35 text-fault'
                              : lease.status === 'bound'
                                ? 'border-link/35 text-link'
                                : 'border-hairline-strong text-ink-3'
                          }`}
                        >
                          {lease.disabled ? 'Disabled' : lease.status === 'bound' ? 'Active' : lease.status || 'Waiting'}
                        </span>
                      </div>
                    </div>
                    <div className="-mr-2 shrink-0">{renderLeaseActions(lease)}</div>
                  </li>
                ))
              )}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px]">MAC Address</TableHead>
                    <TableHead className="w-[120px]">IP Address</TableHead>
                    <TableHead className="w-[150px]">Hostname</TableHead>
                    <TableHead>Comment</TableHead>
                    <TableHead className="w-[100px]">Type</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    [...Array(8)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                      </TableRow>
                    ))
                  ) : filteredLeases.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <p className="text-muted-foreground">No leases found</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLeases.map((lease) => (
                      <TableRow
                        key={lease.id}
                        className={`hover:bg-muted/50 ${lease.disabled ? 'opacity-50' : ''}`}
                      >
                        <TableCell className="font-mono text-xs">
                          {lease.mac}
                        </TableCell>
                        <TableCell className="font-mono text-sm font-medium">
                          {lease.address}
                        </TableCell>
                        <TableCell className="text-sm">
                          {lease.hostname || '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {lease.comment || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              lease.dynamic
                                ? 'bg-gray-500/20 text-gray-400'
                                : 'bg-blue-500/20 text-blue-400'
                            }
                          >
                            {lease.dynamic ? 'Dynamic' : 'Static'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {lease.disabled ? (
                            <Badge variant="outline" className="bg-red-500/20 text-red-400">
                              <XCircle className="h-3 w-3 mr-1" />
                              Disabled
                            </Badge>
                          ) : lease.status === 'bound' ? (
                            <Badge variant="outline" className="bg-green-500/20 text-green-400">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-gray-500/20 text-gray-400">
                              {lease.status || 'Waiting'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {renderLeaseActions(lease)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Static Lease</DialogTitle>
            <DialogDescription>
              Create a new static DHCP reservation. The device will always receive this IP address.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="mac">MAC Address *</Label>
              <Input
                id="mac"
                placeholder="00:11:22:33:44:55"
                value={formData.mac}
                onChange={(e) => setFormData({ ...formData, mac: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">IP Address *</Label>
              <Input
                id="address"
                placeholder="10.10.10.100"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="comment">Comment (Device Name)</Label>
              <Input
                id="comment"
                placeholder="Kevin's MacBook"
                value={formData.comment}
                onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate}>Create Lease</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Lease</DialogTitle>
            <DialogDescription>
              Update the comment for {selectedLease?.mac}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>MAC Address</Label>
              <Input value={formData.mac} disabled />
            </div>
            <div className="space-y-2">
              <Label>IP Address</Label>
              <Input value={formData.address} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-comment">Comment (Device Name)</Label>
              <Input
                id="edit-comment"
                placeholder="Kevin's MacBook"
                value={formData.comment}
                onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lease?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the DHCP lease for {selectedLease?.mac}
              {selectedLease?.comment && ` (${selectedLease.comment})`}.
              The device will get a new dynamic IP on next connection.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
