export type DropDto = {
  id: string; slug: string; title: string; description: string;
  price: number; originalPrice: number | null; currency: 'PKR';
  startsAt: string; endsAt: string; imageUrl: string | null;
};
