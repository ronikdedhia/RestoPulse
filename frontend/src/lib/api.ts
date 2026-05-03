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

export const fetchInsightDiff = (id: string) =>
  api.get(`/api/insights/restaurant/${id}/diff`).then((r) => r.data.data);

export const fetchDishMentions = (id: string) =>
  api.get(`/api/insights/restaurant/${id}/dishes`).then((r) => r.data.data);

export const fetchVelocityData = (id: string) =>
  api.get(`/api/insights/restaurant/${id}/velocity`).then((r) => r.data.data);

export const fetchStaffMentions = (id: string) =>
  api.get(`/api/insights/restaurant/${id}/staff`).then((r) => r.data.data);

export const fetchFakeReviews = (id: string) =>
  api.get(`/api/insights/restaurant/${id}/fake-reviews`).then((r) => r.data.data);

export const fetchActiveAlerts = () =>
  api.get('/api/insights/alerts').then((r) => r.data.data);

export const fetchPriceSensitivity = (id: string) =>
  api.get(`/api/insights/restaurant/${id}/price-sensitivity`).then((r) => r.data.data);

export const fetchPersistentIssues = (id: string) =>
  api.get(`/api/insights/restaurant/${id}/persistent-issues`).then((r) => r.data.data);

export const updateDigestSettings = (id: string, data: { ownerEmail?: string; digestEnabled?: boolean }) =>
  api.patch(`/api/restaurants/${id}/digest`, data).then((r) => r.data.data);

export const fetchOwnerEvents = (id: string) =>
  api.get(`/api/restaurants/${id}/events`).then((r) => r.data.data);

export const createOwnerEvent = (id: string, data: { description: string; eventDate?: string }) =>
  api.post(`/api/restaurants/${id}/events`, data).then((r) => r.data.data);

export const deleteOwnerEvent = (restaurantId: string, eventId: string) =>
  api.delete(`/api/restaurants/${restaurantId}/events/${eventId}`).then((r) => r.data);

export const fetchHealthScore = (id: string) =>
  api.get(`/api/restaurants/${id}/health-score`).then((r) => r.data.data);

export const syncAuthUser = (token: string, data: { email: string; firstName?: string; lastName?: string; imageUrl?: string }) =>
  api.post('/api/auth/sync', data, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.data.data);

export const claimRestaurant = (token: string, restaurantId: string) =>
  api.post(`/api/auth/restaurants/${restaurantId}/claim`, {}, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.data.data);

export const fetchRedFlags = (id: string) =>
  api.get(`/api/insights/restaurant/${id}/red-flags`).then((r) => r.data.data);

export const fetchSourceDivergence = (id: string) =>
  api.get(`/api/insights/restaurant/${id}/source-divergence`).then((r) => r.data.data);

export const fetchCustomerSegments = (id: string) =>
  api.get(`/api/insights/restaurant/${id}/customer-segments`).then((r) => r.data.data);
