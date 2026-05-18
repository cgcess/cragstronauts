// Thin fetch wrappers around the FastAPI backend.

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
  getTrip: () => req("GET", "/api/trip"),
  createTrip: (data) => req("POST", "/api/trip", data),

  listUsers: () => req("GET", "/api/users"),
  createUser: (name) => req("POST", "/api/users", { name, joining: true }),
  updateUser: (id, data) => req("PATCH", `/api/users/${id}`, data),

  listCategories: () => req("GET", "/api/gear-categories"),
  addCategory: (data) => req("POST", "/api/gear-categories", data),

  listCars: () => req("GET", "/api/cars"),
  createCar: (data) => req("POST", "/api/cars", data),
  deleteCar: (id) => req("DELETE", `/api/cars/${id}`),
  carSignup: (carId, userId) =>
    req("POST", `/api/cars/${carId}/signup`, { user_id: userId }),
  carSignoff: (carId, userId) =>
    req("DELETE", `/api/cars/${carId}/signup/${userId}`),

  listGear: () => req("GET", "/api/gear"),
  addGear: (data) => req("POST", "/api/gear", data),
  deleteGear: (id) => req("DELETE", `/api/gear/${id}`),
};
