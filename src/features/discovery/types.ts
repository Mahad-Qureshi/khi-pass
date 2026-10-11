export type ExperienceDto = {
  id: string; slug: string; title: string; description: string;
  venue: string; area: string; category: string; price: number;
  maxPrice: number | null; currency: 'PKR'; imageUrl: string | null;
  createdAt: string; featured: boolean; vibeSlugs: string[];
};
