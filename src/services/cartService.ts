import { supabase } from './supabase';

export interface CartItem {
  id: string;
  equipmentId: string;
  addedAt: Date;
}

async function getOrCreateCartId(): Promise<string> {
  const { data: existing } = await supabase
    .from('carts')
    .select('id')
    .maybeSingle();
  if (existing) return existing.id as string;

  const { data: { user } } = await supabase.auth.getUser();
  const { data: created, error } = await supabase
    .from('carts')
    .insert({ user_id: user?.id })
    .select('id')
    .single();
  if (error) throw error;
  return created.id as string;
}

export const cartService = {
  async getItems(): Promise<CartItem[]> {
    const cartId = await getOrCreateCartId();
    const { data, error } = await supabase
      .from('cart_items')
      .select('id, equipment_id, added_at')
      .eq('cart_id', cartId)
      .order('added_at', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id as string,
      equipmentId: row.equipment_id as string,
      addedAt: new Date(row.added_at as string),
    }));
  },

  async addItem(equipmentId: string): Promise<void> {
    const cartId = await getOrCreateCartId();
    const { error } = await supabase
      .from('cart_items')
      .insert({ cart_id: cartId, equipment_id: equipmentId });
    if (error && !error.message.includes('unique')) throw error;
  },

  async removeItem(equipmentId: string): Promise<void> {
    const cartId = await getOrCreateCartId();
    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('cart_id', cartId)
      .eq('equipment_id', equipmentId);
    if (error) throw error;
  },

  async clear(): Promise<void> {
    const cartId = await getOrCreateCartId();
    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('cart_id', cartId);
    if (error) throw error;
  },
};
