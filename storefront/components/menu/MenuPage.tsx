'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import Header from './Header'
import CategoryNav from './CategoryNav'
import ItemCard from './ItemCard'
import ItemModal from './ItemModal'
import CartButton from '../cart/CartButton'
import type { RestaurantConfig, Restaurant, Franchise, Category, Item } from '../../types'

const ARABIC_COUNTRIES = new Set(['EG', 'SA', 'AE', 'KW', 'QA', 'BH', 'OM', 'JO', 'LB', 'MA', 'TN', 'DZ', 'LY', 'SD', 'IQ', 'SY', 'YE', 'PS'])

interface Props {
  config: RestaurantConfig
  restaurant: Restaurant
  franchises: Franchise[]
  categories: Category[]
}

export default function MenuPage({ config, restaurant, franchises, categories }: Props) {
  const isRtl = ARABIC_COUNTRIES.has((config.preferredCountry ?? '').toUpperCase())
  const currency = getCurrency(config.preferredCountry)

  const [activeCatId, setActiveCatId] = useState<number | null>(
    categories.length > 0 ? categories[0].id : null,
  )
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  const catSectionRefs = useRef<Record<number, HTMLElement | null>>({})
  const observerRef = useRef<IntersectionObserver | null>(null)
  const userScrollingRef = useRef(false)

  // Track which category section is in view
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect()

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (userScrollingRef.current) return
        let best: IntersectionObserverEntry | null = null
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (!best || entry.intersectionRatio > best.intersectionRatio) best = entry
          }
        }
        if (best) {
          const id = Number((best.target as HTMLElement).dataset.catid)
          setActiveCatId(id)
        }
      },
      { threshold: [0.1, 0.3, 0.5], rootMargin: '-100px 0px -60% 0px' },
    )

    for (const section of Object.values(catSectionRefs.current)) {
      if (section) observerRef.current.observe(section)
    }

    return () => observerRef.current?.disconnect()
  }, [categories])

  function scrollToCategory(id: number) {
    const section = catSectionRefs.current[id]
    if (!section) return
    userScrollingRef.current = true
    setActiveCatId(id)
    const top = section.getBoundingClientRect().top + window.scrollY - 120
    window.scrollTo({ top, behavior: 'smooth' })
    setTimeout(() => { userScrollingRef.current = false }, 700)
  }

  const setCatRef = useCallback((el: HTMLElement | null, id: number) => {
    catSectionRefs.current[id] = el
  }, [])

  return (
    <div>
      <Header restaurant={restaurant} isRtl={isRtl} />
      <CategoryNav
        categories={categories}
        activeId={activeCatId}
        isRtl={isRtl}
        onSelect={scrollToCategory}
      />

      {/* Hero banner */}
      {restaurant.backgroundImg && (
        <div style={{ position: 'relative', width: '100%', height: 160, overflow: 'hidden' }}>
          <Image
            src={restaurant.backgroundImg}
            alt={restaurant.name}
            fill
            style={{ objectFit: 'cover' }}
            priority
          />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,.5))' }} />
        </div>
      )}

      {/* Menu body */}
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 16px 120px' }}>
        {categories.map((cat) => {
          const catName = isRtl && cat.name_arabic ? cat.name_arabic : cat.name
          const activeItems = cat.items.filter((i) => i.is_active)
          if (activeItems.length === 0) return null

          return (
            <section
              key={cat.id}
              data-catid={cat.id}
              ref={(el) => setCatRef(el, cat.id)}
              style={{ marginTop: 24 }}
            >
              <h2 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 14 }}>
                {catName}
              </h2>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                  gap: 12,
                }}
              >
                {activeItems.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    isRtl={isRtl}
                    currency={currency}
                    onClick={() => setSelectedItem(item)}
                  />
                ))}
              </div>
            </section>
          )
        })}
      </div>

      {/* Floating cart button */}
      <CartButton isRtl={isRtl} currency={currency} />

      {/* Item modal */}
      {selectedItem && (
        <ItemModal
          item={selectedItem}
          isRtl={isRtl}
          currency={currency}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  )
}

function getCurrency(country?: string): string {
  const map: Record<string, string> = {
    EG: 'EGP', SA: 'SAR', AE: 'AED', KW: 'KWD', QA: 'QAR', BH: 'BHD',
    OM: 'OMR', JO: 'JOD', LB: 'LBP', MA: 'MAD',
  }
  return map[(country ?? '').toUpperCase()] ?? 'EGP'
}
