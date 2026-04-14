'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { adminGet } from '../../lib/api'
import { getSupabaseClient } from '../../lib/supabase'
import { getAdmin } from '../../lib/auth'
import { STATE, type Order, type FranchiseInfo } from '../../types'
import OrderCard from './OrderCard'

interface Props {
  franchises: FranchiseInfo[]
}

const ACTIVE_STATES = [STATE.PENDING, STATE.ACCEPTED, STATE.READY, STATE.ON_WAY_TO_DELIVERY, STATE.ON_WAY_TO_PICKUP]

export default function OrdersBoard({ franchises }: Props) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set())
  const [selectedFranchise, setSelectedFranchise] = useState<number | ''>('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'error'>('connecting')
  const restaurantId = useRef<number | null>(null)

  const fetchOrders = useCallback(async () => {
    const qs = new URLSearchParams()
    qs.set('states', ACTIVE_STATES.join(','))
    qs.set('date', date)
    if (selectedFranchise) qs.set('franchiseId', String(selectedFranchise))
    try {
      const { orders: list } = await adminGet<{ orders: Order[]; total: number }>(
        `/restaurant/orders?${qs}`,
      )
      setOrders(list)
    } catch {
      // user will see stale data — not fatal
    } finally {
      setLoading(false)
    }
  }, [date, selectedFranchise])

  // Initial load + refresh when filters change
  useEffect(() => {
    setLoading(true)
    fetchOrders()
  }, [fetchOrders])

  // Supabase Realtime subscription
  useEffect(() => {
    const admin = getAdmin()
    if (!admin) return
    restaurantId.current = admin.restaurant_id
    const supabase = getSupabaseClient()

    const channel = supabase
      .channel(`merchant-orders-${admin.restaurant_id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'receipts',
          filter: `restaurant_id=eq.${admin.restaurant_id}`,
        },
        async (payload) => {
          // New order — fetch full order with items then add to board
          try {
            const { order } = await adminGet<{ order: Order }>(`/restaurant/orders/${payload.new.id}`)
            setOrders((prev) => {
              if (prev.some((o) => o.id === order.id)) return prev
              return [order, ...prev]
            })
            setNewOrderIds((prev) => new Set(prev).add(order.id))
            setTimeout(() => {
              setNewOrderIds((prev) => {
                const next = new Set(prev)
                next.delete(order.id)
                return next
              })
            }, 5000)
          } catch {}
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'receipts',
          filter: `restaurant_id=eq.${admin.restaurant_id}`,
        },
        (payload) => {
          setOrders((prev) =>
            prev.map((o) => (o.id === payload.new.id ? { ...o, ...(payload.new as Partial<Order>) } : o)),
          )
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtimeStatus('connected')
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setRealtimeStatus('error')
      })

    return () => { supabase.removeChannel(channel) }
  }, [])

  // Auto-refresh every 60s as fallback
  useEffect(() => {
    const timer = setInterval(fetchOrders, 60_000)
    return () => clearInterval(timer)
  }, [fetchOrders])

  function handleOrderUpdated(updated: Order) {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
  }

  const activeOrders = orders.filter((o) => ACTIVE_STATES.includes(o.state as typeof ACTIVE_STATES[number]))
  const pendingCount = orders.filter((o) => o.state === STATE.PENDING).length
  const acceptedCount = orders.filter((o) => o.state === STATE.ACCEPTED).length
  const readyCount = orders.filter((o) => o.state === STATE.READY).length

  const isToday = date === new Date().toISOString().slice(0, 10)

  return (
    <div style={{ padding: '24px 24px 40px' }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontWeight: 800, fontSize: '1.4rem', marginBottom: 2 }}>Live orders</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: realtimeStatus === 'connected' ? '#22c55e' : realtimeStatus === 'error' ? '#ef4444' : '#f59e0b',
              }}
            />
            <span style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>
              {realtimeStatus === 'connected' ? 'Live' : realtimeStatus === 'error' ? 'Realtime unavailable — auto-refreshing' : 'Connecting…'}
            </span>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {franchises.length > 1 && (
            <select
              className="input"
              style={{ width: 180 }}
              value={selectedFranchise}
              onChange={(e) => setSelectedFranchise(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">All branches</option>
              {franchises.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          )}
          <input
            className="input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ width: 160 }}
          />
          <button
            className="btn btn-ghost"
            onClick={() => { setLoading(true); fetchOrders() }}
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : '↺ Refresh'}
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Pending', count: pendingCount, cls: 'badge-pending' },
          { label: 'Preparing', count: acceptedCount, cls: 'badge-accepted' },
          { label: 'Ready', count: readyCount, cls: 'badge-ready' },
        ].map(({ label, count, cls }) => (
          <div
            key={label}
            className="card"
            style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10 }}
          >
            <span className={`badge ${cls}`}>{count}</span>
            <span style={{ fontWeight: 600, fontSize: '.875rem' }}>{label}</span>
          </div>
        ))}
        {!isToday && (
          <button
            className="btn btn-ghost"
            style={{ fontSize: '.8rem' }}
            onClick={() => setDate(new Date().toISOString().slice(0, 10))}
          >
            Back to today
          </button>
        )}
      </div>

      {/* Orders grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <div className="spinner" />
        </div>
      ) : activeOrders.length === 0 ? (
        <div
          className="card"
          style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--text-muted)' }}
        >
          <p style={{ fontSize: '2rem', marginBottom: 8 }}>🎉</p>
          <p style={{ fontWeight: 600 }}>No active orders</p>
          <p style={{ fontSize: '.875rem', marginTop: 4 }}>
            {isToday ? 'New orders will appear here automatically.' : 'No active orders for this date.'}
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 14,
          }}
        >
          {activeOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              isNew={newOrderIds.has(order.id)}
              onUpdated={handleOrderUpdated}
            />
          ))}
        </div>
      )}
    </div>
  )
}
