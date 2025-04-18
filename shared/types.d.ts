export type Ebook = {
  id: number;
  category: string;
  title: string;
  author: string;
  description: string;
  published: boolean;
  rating: number;
  [key: `description_${string}`]: string | undefined; 
};
