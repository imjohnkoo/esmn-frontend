import { defineStore } from 'pinia';
import type { Order } from '~/types/order';

interface OrderState {
  orders: Order[] | null;
  singleOrder: Order | null;
  isLoading: boolean;
  error: string | null;
}

export const useOrderStore = defineStore('order', {
  state: (): OrderState => ({
    orders: null,
    singleOrder: null,
    isLoading: false,
    error: null,
  }),

  getters: {
    hasOrders: (state) => state.orders !== null && state.orders.length > 0,
    hasSingleOrder: (state) => state.singleOrder !== null,
    orderCount: (state) => state.orders?.length ?? 0,
    hasEsims: (state) => (state.singleOrder?.esims?.length ?? 0) > 0,
    /** 이 주문번호의 목록을 들고 있는가 — order-flow 미들웨어가 복원 여부를 판정할 때 쓴다 */
    hasOrdersFor: (state) => (orderId: number) =>
      !!state.orders &&
      state.orders.length > 0 &&
      state.orders.every((order) => order.orderId === orderId),
  },

  actions: {
    setOrders(orders: Order[]) {
      this.orders = orders;
      this.error = null;
    },

    setSingleOrder(order: Order) {
      this.singleOrder = order;
      this.error = null;
    },

    updateSingleOrder(updates: Partial<Order>) {
      if (this.singleOrder) {
        this.singleOrder = { ...this.singleOrder, ...updates };
      }
    },

    setLoading(loading: boolean) {
      this.isLoading = loading;
    },

    setError(error: string | null) {
      this.error = error;
    },

    clearStore() {
      this.orders = null;
      this.singleOrder = null;
      this.isLoading = false;
      this.error = null;
    },

    clearSingleOrder() {
      this.singleOrder = null;
    },
  },
});
