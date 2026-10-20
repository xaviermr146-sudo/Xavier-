export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const apiKey = process.env.VEHICLES_API_KEY;

  if (!apiKey) {
    return res.status(503).json({
      error: "Car listings service is not configured yet."
    });
  }

  const { make, model, year } = req.query;

  if (!make || !model) {
    return res.status(400).json({
      error: "Please provide a car make and model."
    });
  }

  const params = new URLSearchParams({
    make: String(make).slice(0, 64),
    model: String(model).slice(0, 64),
    limit: "10"
  });

  if (year && /^\d{4}$/.test(String(year))) {
    params.set("year_min", String(year));
    params.set("year_max", String(year));
  }

  try {
    const response = await fetch(
      `https://api.vehicles.dev/v1/vehicles/listings?${params}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json"
        }
      }
    );

    if (!response.ok) {
      return res.status(502).json({
        error: "The car listings provider could not complete the request."
      });
    }

    const data = await response.json();

    return res.status(200).json({
      source: "Vehicles.dev",
      currency: "USD",
      total: data.total ?? data.count ?? 0,
      listings: (data.results || []).map(car => ({
        make: car.make,
        model: car.model,
        year: car.year,
        price: car.price,
        mileage: car.miles,
        location: [car.city, car.state]
          .filter(Boolean)
          .join(", "),
        seller: car.dealer_name,
        listingUrl: car.vdp_url,
        image: car.primaryImage || null
      }))
    });
  } catch {
    return res.status(502).json({
      error: "Unable to retrieve car listings right now."
    });
  }
}
