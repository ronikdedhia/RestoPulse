import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
  timeout: 30_000,
});

export const fetchRestaurants = () => api.get('/api/restaurants').then((r) => r.data.data);
export const fetchRestaurant = (id: string) => api.get(`/api/restaurants/${id}`).then((r) => r.data.data);
export const fetchInsights = () => api.get('/api/insights').then((r) => r.data.data);
export const fetchRestaurantInsights = (id: string) => api.get(`/api/insights/restaurant/${id}`).then((r) => r.data.data);
export const fetchReviewStats = (id: string) => api.get(`/api/reviews/restaurant/${id}/stats`).then((r) => r.data.data);
export const fetchJobs = () => api.get('/api/jobs').then((r) => r.data.data);
export const fetchQueueStats = () => api.get('/api/jobs/queue-stats').then((r) => r.data.data);

export const createRestaurant = (data: {
  name: string;
  address: string;
  googleMapsUrl?: string;
  zomatoUrl?: string;
  cuisine?: string;
}) => api.post('/api/restaurants', data).then((r) => r.data);

export const triggerInsights = (restaurantId: string) =>
  api.post(`/api/insights/restaurant/${restaurantId}/generate`).then((r) => r.data);
