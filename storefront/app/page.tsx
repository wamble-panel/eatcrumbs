import { serverGet } from '../lib/server-api'
import MenuPage from '../components/menu/MenuPage'
import type { RestaurantConfig, Restaurant, Franchise, Category } from '../types'

async function getPageData() {
  // First get restaurant ID from config
  const { config } = await serverGet<{ config: RestaurantConfig }>('/config')
  if (!config.restaurantId) {
    return { config, restaurant: null, franchises: [], categories: [] }
  }

  const [restaurantData, menuData] = await Promise.all([
    serverGet<{ restaurant: Restaurant; franchises: Franchise[] }>(
      `/restaurant/${config.restaurantId}`,
    ),
    serverGet<{ categories: Category[] }>(
      `/category/details/${config.restaurantId}`,
    ),
  ])

  return {
    config,
    restaurant: restaurantData.restaurant,
    franchises: restaurantData.franchises,
    categories: menuData.categories,
  }
}

export default async function Home() {
  try {
    const { config, restaurant, franchises, categories } = await getPageData()

    if (!restaurant) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <p style={{ color: 'var(--text-muted)' }}>Restaurant not found.</p>
        </div>
      )
    }

    return (
      <MenuPage
        config={config}
        restaurant={restaurant}
        franchises={franchises}
        categories={categories}
      />
    )
  } catch (err) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p style={{ color: 'var(--text-muted)' }}>
          Unable to load menu. Please try again.
        </p>
      </div>
    )
  }
}
