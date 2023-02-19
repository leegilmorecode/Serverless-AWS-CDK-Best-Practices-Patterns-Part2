export type Order = {
  id: string;
  quantity: number;
  productId: string;
  storeId: string;
  created: string;
  type: string;
};

export type Store = {
  id: string;
  storeCode: string;
  storeName: string;
  type: string;
};
export type Stores = Store[];
