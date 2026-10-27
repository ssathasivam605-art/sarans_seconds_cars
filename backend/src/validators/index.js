export function validString(value, max = 150, min = 1) {
  return typeof value === 'string' && value.trim().length >= min && value.trim().length <= max;
}

export function validEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validPhone(value) {
  return typeof value === 'string' && /^[+()\d\s-]{7,20}$/.test(value);
}

export function validateCarInput(body) {
  const { brand, model, year, price, mileage, fuel, transmission, owners, location, description, sellerName, sellerPhone } = body;
  const currentYear = new Date().getFullYear() + 1;
  if (!validString(brand, 60) || !validString(model, 80) ||
      !Number.isInteger(Number(year)) || Number(year) < 1950 || Number(year) > currentYear ||
      !Number.isInteger(Number(price)) || Number(price) < 10000 || Number(price) > 100000000 ||
      !Number.isInteger(Number(mileage)) || Number(mileage) < 0 || Number(mileage) > 2000000 ||
      !['Petrol','Diesel','CNG','Electric','Hybrid'].includes(fuel) ||
      !['Manual','Automatic'].includes(transmission) ||
      !Number.isInteger(Number(owners)) || Number(owners) < 1 || Number(owners) > 10 ||
      !validString(location, 80) || !validString(description, 2000, 15) ||
      !validString(sellerName, 80) || !validPhone(sellerPhone)) {
    throw Object.assign(new Error('Check the required fields. Prices must be at least ₹10,000; year, mileage, fuel, transmission, and contact details must be valid.'), { status: 400 });
  }
  return {
    brand: brand.trim(), model: model.trim(), year: Number(year), price: Number(price),
    mileage: Number(mileage), fuel, transmission, owners: Number(owners),
    location: location.trim(), description: description.trim(),
    sellerName: sellerName.trim(), sellerPhone: sellerPhone.trim()
  };
}
