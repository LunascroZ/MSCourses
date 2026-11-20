import { createRouter, createWebHistory } from 'vue-router'
import DraftList from '../views/DraftList.vue'
import ShoppingList from '../views/ShoppingList.vue'
import Stock from '../views/Stock.vue'
import History from '../views/History.vue'
import BonusInsights from '../views/BonusInsights.vue'

const routes = [
  { path: '/', redirect: '/draft' },
  { path: '/draft', name: 'Draft', component: DraftList },
  { path: '/shopping', name: 'Shopping', component: ShoppingList },
  { path: '/stock', name: 'Stock', component: Stock  },
  { path: '/history', name: 'History', component: History },
  {
    path: '/bonus',
    name: 'BonusInsights',
    component: BonusInsights,
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router