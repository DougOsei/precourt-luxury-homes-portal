import React, { useState, useEffect } from 'react';
import { 
  Wrench, 
  Plus, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  DollarSign, 
  User, 
  Building2, 
  Edit, 
  Trash2, 
  Phone, 
  Check, 
  Filter,
  X,
  FileCheck
} from 'lucide-react';
import { api } from '../api';
import { formatCurrency, formatDate, getStatusBadgeClass } from '../utils';

export default function MaintenanceView({ 
  onShowToast, 
  preselectedTicket = null,
  preselectedTenant = null 
}) {
  const [requests, setRequests] = useState([]);
  const [properties, setProperties] = useState([]);
  const [units, setUnits] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Modals
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState(null);
  const [ticketForm, setTicketForm] = useState({
    property_id: '',
    unit_id: '',
    tenant_id: '',
    title: '',
    description: '',
    category: 'general',
    priority: 'medium',
    status: 'reported',
    estimated_cost: '',
    actual_cost: '',
    contractor_name: '',
    contractor_phone: '',
    invoice_ref: '',
    date_reported: new Date().toISOString().split('T')[0],
    date_scheduled: '',
    date_completed: '',
    notes: ''
  });

  // Quick Resolve / Cost Modal
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [resolvingTicket, setResolvingTicket] = useState(null);
  const [resolveForm, setResolveForm] = useState({
    status: 'completed',
    actual_cost: '',
    notes: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [maintData, propsData, unitsData, tenantsData] = await Promise.all([
        api.getMaintenance(),
        api.getProperties(),
        api.getUnits(),
        api.getTenants()
      ]);
      setRequests(maintData);
      setProperties(propsData);
      setUnits(unitsData);
      setTenants(tenantsData);

      if (preselectedTicket) {
        handleOpenResolveModal(preselectedTicket);
      } else if (preselectedTenant) {
        handleOpenTicketModal(null, preselectedTenant);
      }
    } catch (err) {
      onShowToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenTicketModal = (ticket = null, tenantDefault = null) => {
    if (ticket) {
      setEditingTicket(ticket);
      setTicketForm({
        property_id: ticket.property_id || '',
        unit_id: ticket.unit_id || '',
        tenant_id: ticket.tenant_id || '',
        title: ticket.title || '',
        description: ticket.description || '',
        category: ticket.category || 'general',
        priority: ticket.priority || 'medium',
        status: ticket.status || 'reported',
        estimated_cost: ticket.estimated_cost || '',
        actual_cost: ticket.actual_cost || '',
        contractor_name: ticket.contractor_name || '',
        contractor_phone: ticket.contractor_phone || '',
        invoice_ref: ticket.invoice_ref || '',
        date_reported: ticket.date_reported || new Date().toISOString().split('T')[0],
        date_scheduled: ticket.date_scheduled || '',
        date_completed: ticket.date_completed || '',
        notes: ticket.notes || ''
      });
    } else {
      setEditingTicket(null);
      let defaultProp = properties[0]?.id || '';
      let defaultUnit = '';
      let defaultTenantId = '';

      if (tenantDefault) {
        defaultTenantId = tenantDefault.id;
        defaultProp = tenantDefault.property_id || defaultProp;
        defaultUnit = tenantDefault.unit_id || '';
      }

      setTicketForm({
        property_id: defaultProp,
        unit_id: defaultUnit,
        tenant_id: defaultTenantId,
        title: '',
        description: '',
        category: 'general',
        priority: 'medium',
        status: 'reported',
        estimated_cost: '',
        actual_cost: '',
        contractor_name: '',
        contractor_phone: '',
        invoice_ref: '',
        date_reported: new Date().toISOString().split('T')[0],
        date_scheduled: '',
        date_completed: '',
        notes: ''
      });
    }
    setTicketModalOpen(true);
  };

  const handleSaveTicket = async (e) => {
    e.preventDefault();
    try {
      if (editingTicket) {
        await api.updateMaintenance(editingTicket.id, ticketForm);
        onShowToast('Maintenance ticket updated', 'success');
      } else {
        await api.createMaintenance(ticketForm);
        onShowToast('Maintenance request logged successfully', 'success');
      }
      setTicketModalOpen(false);
      fetchData();
    } catch (err) {
      onShowToast(err.message, 'error');
    }
  };

  const handleOpenResolveModal = (ticket) => {
    setResolvingTicket(ticket);
    setResolveForm({
      status: 'completed',
      actual_cost: ticket.actual_cost > 0 ? ticket.actual_cost : (ticket.estimated_cost || ''),
      notes: ticket.notes || 'Repair completed and inspected.'
    });
    setResolveModalOpen(true);
  };

  const handleSaveResolve = async (e) => {
    e.preventDefault();
    try {
      await api.updateMaintenanceStatus(resolvingTicket.id, resolveForm);
      onShowToast(`Ticket marked as ${resolveForm.status}. Actual cost recorded: ${formatCurrency(resolveForm.actual_cost)}`, 'success');
      setResolveModalOpen(false);
      fetchData();
    } catch (err) {
      onShowToast(err.message, 'error');
    }
  };

  const handleDeleteTicket = async (id, title) => {
    if (!window.confirm(`Are you sure you want to delete maintenance ticket "${title}"?`)) return;
    try {
      await api.deleteMaintenance(id);
      onShowToast('Maintenance ticket removed', 'success');
      fetchData();
    } catch (err) {
      onShowToast(err.message, 'error');
    }
  };

  // Metrics
  const openCount = requests.filter(r => ['reported', 'in_progress', 'scheduled'].includes(r.status)).length;
  const urgentCount = requests.filter(r => r.priority === 'urgent' && r.status !== 'completed').length;
  const totalActualCost = requests.reduce((acc, r) => acc + (r.actual_cost || 0), 0);
  const totalEstimatedCost = requests.reduce((acc, r) => acc + (r.estimated_cost || 0), 0);

  // Filtered tickets
  const filteredRequests = requests.filter(r => {
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || r.priority === priorityFilter;
    const matchesCategory = categoryFilter === 'all' || r.category === categoryFilter;

    const q = searchTerm.toLowerCase();
    const matchesSearch = 
      r.title?.toLowerCase().includes(q) ||
      r.description?.toLowerCase().includes(q) ||
      r.property_name?.toLowerCase().includes(q) ||
      r.tenant_name?.toLowerCase().includes(q) ||
      r.contractor_name?.toLowerCase().includes(q);

    return matchesStatus && matchesPriority && matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* 1. Maintenance Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Active Work Orders</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-extrabold text-slate-900">{openCount}</div>
          <p className="mt-1 text-xs text-slate-500">In queue or scheduled</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Urgent Priority</span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className={`mt-3 text-3xl font-extrabold ${urgentCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
            {urgentCount}
          </div>
          <p className="mt-1 text-xs text-slate-500">Immediate attention needed</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Total Actual Costs</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-extrabold text-slate-900">
            {formatCurrency(totalActualCost)}
          </div>
          <p className="mt-1 text-xs text-slate-500">Paid out to vendors/contractors</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Estimated Incurred</span>
            <div className="p-2 rounded-xl bg-slate-50 text-slate-600">
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-extrabold text-slate-900">
            {formatCurrency(totalEstimatedCost)}
          </div>
          <p className="mt-1 text-xs text-slate-500">Budgeted initial estimates</p>
        </div>
      </div>

      {/* 2. Filter Bar & Log Button */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search */}
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search title, contractor, unit..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl"
            />
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 font-medium"
          >
            <option value="all">All Statuses</option>
            <option value="reported">Reported</option>
            <option value="in_progress">In Progress</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {/* Priority filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 font-medium"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* Category filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 font-medium"
          >
            <option value="all">All Categories</option>
            <option value="plumbing">Plumbing</option>
            <option value="electrical">Electrical</option>
            <option value="hvac">HVAC / Heating / AC</option>
            <option value="appliance">Appliance</option>
            <option value="structural">Structural</option>
            <option value="pest_control">Pest Control</option>
            <option value="general">General</option>
          </select>
        </div>

        <button
          onClick={() => handleOpenTicketModal()}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition"
        >
          <Plus className="w-4 h-4" />
          Log Maintenance Ticket
        </button>

      </div>

      {/* 3. Maintenance Requests Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Wrench className="w-4 h-4 text-indigo-600" />
              Maintenance Requests & Costs Ledger ({filteredRequests.length})
            </h2>
            <p className="text-xs text-slate-500">Track technician schedules, repair progress, and actual expenditures</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="px-5 py-3">Ticket & Description</th>
                <th className="px-5 py-3">Location</th>
                <th className="px-5 py-3">Category / Priority</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Contractor / Vendor</th>
                <th className="px-5 py-3 text-right">Cost (Est vs Act)</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRequests.length > 0 ? (
                filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/60 transition">
                    
                    <td className="px-5 py-3.5 max-w-xs">
                      <div className="font-bold text-slate-900 text-sm leading-tight">{req.title}</div>
                      <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{req.description}</p>
                      <span className="text-[10px] text-slate-400 mt-1 block">Reported: {formatDate(req.date_reported)}</span>
                    </td>

                    <td className="px-5 py-3.5 text-xs">
                      <div className="font-semibold text-slate-800">{req.property_name}</div>
                      <div className="text-slate-500">
                        {req.unit_number ? `Unit ${req.unit_number}` : 'Common Area'}
                      </div>
                      {req.tenant_name && (
                        <div className="text-[11px] text-indigo-600 font-medium mt-0.5">
                          By: {req.tenant_name}
                        </div>
                      )}
                    </td>

                    <td className="px-5 py-3.5 space-y-1">
                      <div>
                        <span className="capitalize text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                          {req.category?.replace('_', ' ')}
                        </span>
                      </div>
                      <div>
                        <span className={`inline-block text-[10px] font-extrabold uppercase px-1.5 py-0.2 rounded border ${getStatusBadgeClass(req.priority)}`}>
                          {req.priority}
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide border ${getStatusBadgeClass(req.status)}`}>
                        {req.status?.replace('_', ' ')}
                      </span>
                      {req.date_scheduled && req.status !== 'completed' && (
                        <span className="block text-[10px] text-slate-400 mt-0.5">
                          Sched: {formatDate(req.date_scheduled)}
                        </span>
                      )}
                      {req.date_completed && (
                        <span className="block text-[10px] text-emerald-600 font-medium mt-0.5">
                          Done: {formatDate(req.date_completed)}
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-xs">
                      {req.contractor_name ? (
                        <div>
                          <span className="font-semibold text-slate-800">{req.contractor_name}</span>
                          {req.contractor_phone && (
                            <span className="block text-slate-400 text-[11px]">{req.contractor_phone}</span>
                          )}
                          {req.invoice_ref && (
                            <span className="block font-mono text-[10px] text-slate-400">Inv: {req.invoice_ref}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Unassigned</span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-right text-xs">
                      <div>
                        <span className="text-slate-400 text-[11px]">Act: </span>
                        <span className={`font-extrabold text-sm ${req.actual_cost > 0 ? 'text-slate-900' : 'text-slate-400'}`}>
                          {formatCurrency(req.actual_cost)}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Est: {formatCurrency(req.estimated_cost)}
                      </div>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {req.status !== 'completed' && (
                          <button
                            onClick={() => handleOpenResolveModal(req)}
                            className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition"
                            title="Complete & Log Actual Cost"
                          >
                            Resolve
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenTicketModal(req)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                          title="Edit Ticket Details"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTicket(req.id, req.title)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Delete Ticket"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-5 py-8 text-center text-slate-400 text-sm">
                    No maintenance tickets found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: LOG / EDIT MAINTENANCE TICKET */}
      {ticketModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                <Wrench className="w-5 h-5 text-indigo-600" />
                {editingTicket ? 'Edit Maintenance Ticket' : 'Log Maintenance Request & Costs'}
              </h3>
              <button 
                onClick={() => setTicketModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTicket} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Property *</label>
                  <select
                    required
                    value={ticketForm.property_id}
                    onChange={(e) => setTicketForm({ ...ticketForm, property_id: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="">-- Select Property --</option>
                    {properties.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Unit (Optional)</label>
                  <select
                    value={ticketForm.unit_id}
                    onChange={(e) => setTicketForm({ ...ticketForm, unit_id: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="">Common Area / Whole Property</option>
                    {units
                      .filter(u => !ticketForm.property_id || u.property_id === ticketForm.property_id)
                      .map(u => (
                        <option key={u.id} value={u.id}>Unit {u.unit_number}</option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Issue Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Master Bathroom Water Leak Under Vanity"
                  value={ticketForm.title}
                  onChange={(e) => setTicketForm({ ...ticketForm, title: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Detailed Description *</label>
                <textarea
                  rows="2"
                  required
                  placeholder="Describe the issue, symptoms, location..."
                  value={ticketForm.description}
                  onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={ticketForm.category}
                    onChange={(e) => setTicketForm({ ...ticketForm, category: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="plumbing">Plumbing</option>
                    <option value="electrical">Electrical</option>
                    <option value="hvac">HVAC / Heating / AC</option>
                    <option value="appliance">Appliance</option>
                    <option value="structural">Structural</option>
                    <option value="pest_control">Pest Control</option>
                    <option value="general">General</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Priority</label>
                  <select
                    value={ticketForm.priority}
                    onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white font-semibold"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={ticketForm.status}
                    onChange={(e) => setTicketForm({ ...ticketForm, status: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="reported">Reported</option>
                    <option value="in_progress">In Progress</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Cost & Contractor Fields */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-3">
                <span className="text-xs font-bold text-slate-700 block">Cost Tracking & Contractor Assignment</span>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Estimated Cost ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={ticketForm.estimated_cost}
                      onChange={(e) => setTicketForm({ ...ticketForm, estimated_cost: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Actual Final Cost ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={ticketForm.actual_cost}
                      onChange={(e) => setTicketForm({ ...ticketForm, actual_cost: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white font-bold text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Contractor / Vendor Name</label>
                    <input
                      type="text"
                      placeholder="e.g. QuickFlow Plumbing"
                      value={ticketForm.contractor_name}
                      onChange={(e) => setTicketForm({ ...ticketForm, contractor_name: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Contractor Phone</label>
                    <input
                      type="tel"
                      placeholder="(555) 000-0000"
                      value={ticketForm.contractor_phone}
                      onChange={(e) => setTicketForm({ ...ticketForm, contractor_phone: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Scheduled Date</label>
                  <input
                    type="date"
                    value={ticketForm.date_scheduled}
                    onChange={(e) => setTicketForm({ ...ticketForm, date_scheduled: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Invoice / Reference #</label>
                  <input
                    type="text"
                    placeholder="INV-9921"
                    value={ticketForm.invoice_ref}
                    onChange={(e) => setTicketForm({ ...ticketForm, invoice_ref: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setTicketModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition"
                >
                  {editingTicket ? 'Save Ticket' : 'Log Maintenance Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: QUICK RESOLVE & ACTUAL COST INPUT */}
      {resolveModalOpen && resolvingTicket && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="w-5 h-5" />
                  Resolve Maintenance Ticket
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">{resolvingTicket.title}</p>
              </div>
              <button 
                onClick={() => setResolveModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveResolve} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                <select
                  value={resolveForm.status}
                  onChange={(e) => setResolveForm({ ...resolveForm, status: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white font-bold"
                >
                  <option value="completed">Completed (Resolved)</option>
                  <option value="in_progress">In Progress</option>
                  <option value="scheduled">Scheduled</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Final Actual Cost ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 175.00"
                  value={resolveForm.actual_cost}
                  onChange={(e) => setResolveForm({ ...resolveForm, actual_cost: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl font-bold text-slate-900"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Original Estimate: {formatCurrency(resolvingTicket.estimated_cost)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Resolution & Completion Notes</label>
                <textarea
                  rows="3"
                  placeholder="Details of repair done, parts used, tenant sign-off..."
                  value={resolveForm.notes}
                  onChange={(e) => setResolveForm({ ...resolveForm, notes: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setResolveModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition"
                >
                  Save & Complete Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
