// Thin fetch wrappers around the backend.

async function req(method, path, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const r = await fetch(path, opts);
  if (!r.ok) {
    let detail = r.statusText;
    try {
      const j = await r.json();
      detail = j.detail || JSON.stringify(j);
    } catch {}
    throw new Error(`${r.status} ${detail}`);
  }
  if (r.status === 204) return null;
  return r.json();
}

export const api = {
  // Trips
  listTrips: () => req("GET", "/api/trips"),
  createTrip: (data) => req("POST", "/api/trips", data),
  getTrip: (tripId) => req("GET", `/api/trips/${tripId}`),
  deleteTrip: (tripId) => req("DELETE", `/api/trips/${tripId}`),

  // Users (within a trip)
  listUsers: (tripId) => req("GET", `/api/trips/${tripId}/users`),
  createUser: (tripId, name) =>
    req("POST", `/api/trips/${tripId}/users`, { name, joining: true }),
  updateUser: (id, data) => req("PATCH", `/api/users/${id}`, data),
  deleteUser: (id) => req("DELETE", `/api/users/${id}`),
  completeSignup: (id) => req("POST", `/api/users/${id}/complete-signup`),

  // Gear categories
  listCategories: (tripId) =>
    req("GET", `/api/trips/${tripId}/gear-categories`),
  addCategory: (tripId, data) =>
    req("POST", `/api/trips/${tripId}/gear-categories`, data),

  // Cars
  listCars: (tripId) => req("GET", `/api/trips/${tripId}/cars`),
  createCar: (tripId, data) => req("POST", `/api/trips/${tripId}/cars`, data),
  deleteCar: (id) => req("DELETE", `/api/cars/${id}`),
  carSignup: (carId, userId) =>
    req("POST", `/api/cars/${carId}/signup`, { user_id: userId }),
  carSignoff: (carId, userId) =>
    req("DELETE", `/api/cars/${carId}/signup/${userId}`),

  // Gear contributions
  listGear: (tripId) => req("GET", `/api/trips/${tripId}/gear`),
  addGear: (tripId, data) => req("POST", `/api/trips/${tripId}/gear`, data),
  deleteGear: (id) => req("DELETE", `/api/gear/${id}`),
};
