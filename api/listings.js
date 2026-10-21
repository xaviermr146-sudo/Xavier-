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
      error: "Car listings service is not configured."
    });
  }

  const make = String(req.query.make || "").trim();
  const model = String(req.query.model || "").trim();
  const year = String(req.query.year || "").trim();

  if (!make || !model || make.length > 64 || model.length > 64) {
    return res.status(400).json({
      error: "Provide a valid car make and model."
    });
  }

  const params = new URLSearchParams({
    make,
    model,
    limit: "10"
  });

  if (year) {
    if (!/^\d{4}$/.test(year)) {
      return res.status(400).json({
        error: "Year must contain four digits."
      });
    }

    const yearNumber = Number(year);

    if (yearNumber < 1900 || yearNumber > 2100) {
      return res.status(400).json({
        error: "Year is outside the supported range."
      });
    }

    params.set("year_min", year);
    params.set("year_max", year);
  }

  try {
    const response = await fetch(
      `https://api.vehicles.dev/v1/vehicles/listings?${params}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json"
        },
        signal: AbortSignal.timeout(18000)
      }
    );

    if (!response.ok) {
      return res.status(502).json({
        error: "The car listings provider returned an error.",
        providerStatus: response.status
      });
    }

    const data = await response.json();

    const listings = Array.isArray(data.results)
      ? data.results.map((car) => ({
          make: car.make ?? null,
          model: car.model ?? null,
          year: car.year ?? null,
          trim: car.trim ?? null,
          price: car.price ?? null,
          currency: "USD",
          mileage: car.miles ?? null,
          condition: car.condition ?? null,
          seller: car.dealer_name ?? null,
          location: [car.city, car.state]
            .filter(Boolean)
            .join(", "),
          listingUrl: car.vdp_url ?? null,
          source: car.source ?? data.source ?? "Vehicles.dev"
        }))
      : [];

    return res.status(200).json({
      source: "Vehicles.dev",
      currency: "USD",
      total: data.total ?? 0,
      listings
    });
  } catch {
    return res.status(502).json({
      error: "Unable to retrieve listings right now."
    });
  }
}
