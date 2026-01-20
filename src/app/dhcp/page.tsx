'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Network,
  ArrowLeft,
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { AgentStatus } from '@/components/agent-status';
import { api, isAuthenticated } from '@/lib/api';
import { toast } from 'sonner';
import type { DHCPLease, HealthStatus } from '@/types';

export default function DHCPPage() {
  const router = useRouter();
  const [leases, setLeases] = useState<DHCPLease[]>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);
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
      const [leasesRes, healthRes] = await Promise.all([
        api.getDHCPLeases().catch(() => ({ leases: [], count: 0 })),
        api.getHealth().catch(() => null),
      ]);
      setLeases(leasesRes.leases || []);
      setHealth(healthRes);
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error: any) {
      toast.error(error.message || 'Failed to create lease');
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
    } catch (error) {
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
    } catch (error) {
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

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </Link>
            <Network className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            <div>
              <h1 className="text-lg sm:text-2xl font-bold">DHCP Leases</h1>
              <p className="text-muted-foreground text-xs sm:text-sm hidden sm:block">
                Manage static IP reservations
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AgentStatus health={health} isConnected={!!health?.routerConnected} />
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2 sm:px-3"
              onClick={() => fetchData()}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 sm:mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Leases
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Pin className="h-4 w-4" />
                Static
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-500">{stats.static}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Dynamic
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">
                {stats.dynamic}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Active
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{stats.active}</div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Add */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
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

        {/* Leases Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
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
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
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
                          </DropdownMenu>
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
    </div>
  );
}
