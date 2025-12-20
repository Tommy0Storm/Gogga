'use client';

import { useState, useEffect } from 'react';
import { MdRefresh, MdEdit, MdSave, MdCancel, MdAdd } from 'react-icons/md';

interface ModelPricing {
  id: string;
  modelId: string;
  displayName: string;
  provider: string;
  inputPricePerM: number;
  outputPricePerM: number;
  imagePricePerUnit: number;
  allowedTiers: string;
  isActive: boolean;
  updatedAt: string;
}

interface FeatureCost {
  id: string;
  featureId: string;
  displayName: string;
  costPerUse: number;
  allowedTiers: string;
  isActive: boolean;
  updatedAt: string;
}

interface ExchangeRate {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  isActive: boolean;
  updatedAt: string;
}

export default function TokensPage() {
  const [modelPricing, setModelPricing] = useState<ModelPricing[]>([]);
  const [featureCosts, setFeatureCosts] = useState<FeatureCost[]>([]);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'models' | 'features' | 'exchange'>('models');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<ModelPricing | FeatureCost | ExchangeRate>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [modelsRes, featuresRes, exchangeRes] = await Promise.all([
        fetch('/api/tokens/models'),
        fetch('/api/tokens/features'),
        fetch('/api/tokens/exchange'),
      ]);

      if (modelsRes.ok) {
        const data = await modelsRes.json();
        setModelPricing(data.models || []);
      }
      if (featuresRes.ok) {
        const data = await featuresRes.json();
        setFeatureCosts(data.features || []);
      }
      if (exchangeRes.ok) {
        const data = await exchangeRes.json();
        setExchangeRates(data.rates || []);
      }
    } catch (error) {
      console.error('Failed to load token data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (id: string, item: ModelPricing | FeatureCost | ExchangeRate) => {
    setEditingId(id);
    setEditValues({ ...item });
  };

  const handleSave = async () => {
    if (!editingId) return;

    try {
      let endpoint = '';
      if (activeTab === 'models') endpoint = '/api/tokens/models';
      else if (activeTab === 'features') endpoint = '/api/tokens/features';
      else endpoint = '/api/tokens/exchange';

      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, ...editValues }),
      });

      if (res.ok) {
        setEditingId(null);
        setEditValues({});
        loadData();
      } else {
        const data = await res.json();
        alert(`Update failed: ${data.error}`);
      }
    } catch {
      alert('Network error');
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditValues({});
  };

  const zarRate = exchangeRates.find(r => r.fromCurrency === 'USD' && r.toCurrency === 'ZAR')?.rate || 18.50;

  const renderModelsTable = () => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--admin-border)]">
            <th className="px-4 py-3 text-left font-semibold">Model</th>
            <th className="px-4 py-3 text-left font-semibold">Provider</th>
            <th className="px-4 py-3 text-right font-semibold">Input ($/M)</th>
            <th className="px-4 py-3 text-right font-semibold">Output ($/M)</th>
            <th className="px-4 py-3 text-right font-semibold">Input (R/M)</th>
            <th className="px-4 py-3 text-right font-semibold">Output (R/M)</th>
            <th className="px-4 py-3 text-center font-semibold">Tiers</th>
            <th className="px-4 py-3 text-center font-semibold">Active</th>
            <th className="px-4 py-3 text-center font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {modelPricing.map((model) => (
            <tr key={model.id} className="border-b border-[var(--admin-border)] hover:bg-[var(--admin-surface)]">
              <td className="px-4 py-3">
                <div>
                  <div className="font-medium">{model.displayName}</div>
                  <div className="text-xs text-[var(--admin-text-muted)]">{model.modelId}</div>
                </div>
              </td>
              <td className="px-4 py-3">
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  model.provider === 'cerebras' ? 'bg-blue-100 text-blue-800' :
                  model.provider === 'openrouter' ? 'bg-purple-100 text-purple-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {model.provider}
                </span>
              </td>
              <td className="px-4 py-3 text-right font-mono">
                {editingId === model.id ? (
                  <input
                    type="number"
                    step="0.01"
                    value={(editValues as ModelPricing).inputPricePerM ?? model.inputPricePerM}
                    onChange={(e) => setEditValues({ ...editValues, inputPricePerM: parseFloat(e.target.value) })}
                    className="w-20 px-2 py-1 text-right bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded"
                  />
                ) : (
                  `$${model.inputPricePerM.toFixed(2)}`
                )}
              </td>
              <td className="px-4 py-3 text-right font-mono">
                {editingId === model.id ? (
                  <input
                    type="number"
                    step="0.01"
                    value={(editValues as ModelPricing).outputPricePerM ?? model.outputPricePerM}
                    onChange={(e) => setEditValues({ ...editValues, outputPricePerM: parseFloat(e.target.value) })}
                    className="w-20 px-2 py-1 text-right bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded"
                  />
                ) : (
                  `$${model.outputPricePerM.toFixed(2)}`
                )}
              </td>
              <td className="px-4 py-3 text-right font-mono text-[var(--admin-text-muted)]">
                R{(model.inputPricePerM * zarRate).toFixed(2)}
              </td>
              <td className="px-4 py-3 text-right font-mono text-[var(--admin-text-muted)]">
                R{(model.outputPricePerM * zarRate).toFixed(2)}
              </td>
              <td className="px-4 py-3 text-center">
                <div className="flex flex-wrap gap-1 justify-center">
                  {model.allowedTiers.split(',').map((tier) => (
                    <span key={tier} className={`px-2 py-0.5 rounded text-xs ${
                      tier === 'jigga' ? 'bg-yellow-100 text-yellow-800' :
                      tier === 'jive' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {tier.toUpperCase()}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-4 py-3 text-center">
                <span className={`w-3 h-3 rounded-full inline-block ${model.isActive ? 'bg-green-500' : 'bg-red-500'}`}></span>
              </td>
              <td className="px-4 py-3 text-center">
                {editingId === model.id ? (
                  <div className="flex gap-1 justify-center">
                    <button onClick={handleSave} className="p-1 text-green-600 hover:bg-green-100 rounded">
                      <MdSave size={18} />
                    </button>
                    <button onClick={handleCancel} className="p-1 text-red-600 hover:bg-red-100 rounded">
                      <MdCancel size={18} />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => handleEdit(model.id, model)} className="p-1 text-blue-600 hover:bg-blue-100 rounded">
                    <MdEdit size={18} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderFeaturesTable = () => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--admin-border)]">
            <th className="px-4 py-3 text-left font-semibold">Feature</th>
            <th className="px-4 py-3 text-right font-semibold">Cost/Use ($)</th>
            <th className="px-4 py-3 text-right font-semibold">Cost/Use (R)</th>
            <th className="px-4 py-3 text-center font-semibold">Tiers</th>
            <th className="px-4 py-3 text-center font-semibold">Active</th>
            <th className="px-4 py-3 text-center font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {featureCosts.map((feature) => (
            <tr key={feature.id} className="border-b border-[var(--admin-border)] hover:bg-[var(--admin-surface)]">
              <td className="px-4 py-3">
                <div>
                  <div className="font-medium">{feature.displayName}</div>
                  <div className="text-xs text-[var(--admin-text-muted)]">{feature.featureId}</div>
                </div>
              </td>
              <td className="px-4 py-3 text-right font-mono">
                {editingId === feature.id ? (
                  <input
                    type="number"
                    step="0.0001"
                    value={(editValues as FeatureCost).costPerUse ?? feature.costPerUse}
                    onChange={(e) => setEditValues({ ...editValues, costPerUse: parseFloat(e.target.value) })}
                    className="w-24 px-2 py-1 text-right bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded"
                  />
                ) : (
                  `$${feature.costPerUse.toFixed(4)}`
                )}
              </td>
              <td className="px-4 py-3 text-right font-mono text-[var(--admin-text-muted)]">
                R{(feature.costPerUse * zarRate).toFixed(4)}
              </td>
              <td className="px-4 py-3 text-center">
                <div className="flex flex-wrap gap-1 justify-center">
                  {feature.allowedTiers.split(',').map((tier) => (
                    <span key={tier} className={`px-2 py-0.5 rounded text-xs ${
                      tier === 'jigga' ? 'bg-yellow-100 text-yellow-800' :
                      tier === 'jive' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {tier.toUpperCase()}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-4 py-3 text-center">
                <span className={`w-3 h-3 rounded-full inline-block ${feature.isActive ? 'bg-green-500' : 'bg-red-500'}`}></span>
              </td>
              <td className="px-4 py-3 text-center">
                {editingId === feature.id ? (
                  <div className="flex gap-1 justify-center">
                    <button onClick={handleSave} className="p-1 text-green-600 hover:bg-green-100 rounded">
                      <MdSave size={18} />
                    </button>
                    <button onClick={handleCancel} className="p-1 text-red-600 hover:bg-red-100 rounded">
                      <MdCancel size={18} />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => handleEdit(feature.id, feature)} className="p-1 text-blue-600 hover:bg-blue-100 rounded">
                    <MdEdit size={18} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderExchangeTable = () => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--admin-border)]">
            <th className="px-4 py-3 text-left font-semibold">From</th>
            <th className="px-4 py-3 text-left font-semibold">To</th>
            <th className="px-4 py-3 text-right font-semibold">Rate</th>
            <th className="px-4 py-3 text-center font-semibold">Active</th>
            <th className="px-4 py-3 text-left font-semibold">Last Updated</th>
            <th className="px-4 py-3 text-center font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {exchangeRates.map((rate) => (
            <tr key={rate.id} className="border-b border-[var(--admin-border)] hover:bg-[var(--admin-surface)]">
              <td className="px-4 py-3 font-medium">{rate.fromCurrency}</td>
              <td className="px-4 py-3 font-medium">{rate.toCurrency}</td>
              <td className="px-4 py-3 text-right font-mono">
                {editingId === rate.id ? (
                  <input
                    type="number"
                    step="0.01"
                    value={(editValues as ExchangeRate).rate ?? rate.rate}
                    onChange={(e) => setEditValues({ ...editValues, rate: parseFloat(e.target.value) })}
                    className="w-24 px-2 py-1 text-right bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded"
                  />
                ) : (
                  rate.rate.toFixed(2)
                )}
              </td>
              <td className="px-4 py-3 text-center">
                <span className={`w-3 h-3 rounded-full inline-block ${rate.isActive ? 'bg-green-500' : 'bg-red-500'}`}></span>
              </td>
              <td className="px-4 py-3 text-[var(--admin-text-muted)]">
                {new Date(rate.updatedAt).toLocaleString()}
              </td>
              <td className="px-4 py-3 text-center">
                {editingId === rate.id ? (
                  <div className="flex gap-1 justify-center">
                    <button onClick={handleSave} className="p-1 text-green-600 hover:bg-green-100 rounded">
                      <MdSave size={18} />
                    </button>
                    <button onClick={handleCancel} className="p-1 text-red-600 hover:bg-red-100 rounded">
                      <MdCancel size={18} />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => handleEdit(rate.id, rate)} className="p-1 text-blue-600 hover:bg-blue-100 rounded">
                    <MdEdit size={18} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Token Pricing</h2>
          <p className="text-[var(--admin-text-muted)]">
            Manage model pricing, feature costs, and exchange rates
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--admin-surface)] hover:bg-[var(--admin-surface-2)] rounded-lg transition-colors"
        >
          <MdRefresh size={18} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-[var(--admin-surface)] rounded-lg border border-[var(--admin-border)]">
          <div className="text-sm text-[var(--admin-text-muted)]">Active Models</div>
          <div className="text-2xl font-bold mt-1">{modelPricing.filter(m => m.isActive).length}</div>
        </div>
        <div className="p-4 bg-[var(--admin-surface)] rounded-lg border border-[var(--admin-border)]">
          <div className="text-sm text-[var(--admin-text-muted)]">Active Features</div>
          <div className="text-2xl font-bold mt-1">{featureCosts.filter(f => f.isActive).length}</div>
        </div>
        <div className="p-4 bg-[var(--admin-surface)] rounded-lg border border-[var(--admin-border)]">
          <div className="text-sm text-[var(--admin-text-muted)]">USD → ZAR Rate</div>
          <div className="text-2xl font-bold mt-1">R{zarRate.toFixed(2)}</div>
        </div>
        <div className="p-4 bg-[var(--admin-surface)] rounded-lg border border-[var(--admin-border)]">
          <div className="text-sm text-[var(--admin-text-muted)]">Cheapest Model (input)</div>
          <div className="text-2xl font-bold mt-1">
            ${Math.min(...modelPricing.filter(m => m.isActive && m.inputPricePerM > 0).map(m => m.inputPricePerM)).toFixed(2) || 'N/A'}/M
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[var(--admin-border)]">
        {[
          { key: 'models', label: 'Model Pricing' },
          { key: 'features', label: 'Feature Costs' },
          { key: 'exchange', label: 'Exchange Rates' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key as typeof activeTab); setEditingId(null); }}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === tab.key
                ? 'text-[var(--admin-text)] border-b-2 border-blue-500'
                : 'text-[var(--admin-text-muted)] hover:text-[var(--admin-text)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-[var(--admin-surface)] rounded-lg border border-[var(--admin-border)]">
        {loading ? (
          <div className="p-8 text-center text-[var(--admin-text-muted)]">Loading...</div>
        ) : (
          <>
            {activeTab === 'models' && renderModelsTable()}
            {activeTab === 'features' && renderFeaturesTable()}
            {activeTab === 'exchange' && renderExchangeTable()}
          </>
        )}
      </div>
    </div>
  );
}
