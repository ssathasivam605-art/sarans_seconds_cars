import { createId, isValidId, toISOString } from '../db/ids.js';
import { execute, query, transaction } from '../config/sqlite.js';
import { logActivity } from '../services/activity.js';

const statuses = ['Pending', 'Contacted', 'Approved', 'Completed', 'Cancelled'];

export async function createEnquiry(req, res) {
  if (!isValidId(req.params.id)) return res.status(404).json({ error: 'This car is sold or no longer available.' });
  const [car] = await query(`SELECT id, brand, model, is_demo AS isDemo, seller_id AS seller
    FROM cars WHERE id = ? AND status = 'approved' LIMIT 1`, [req.params.id]);
  if (!car) return res.status(409).json({ error: 'This car is sold or no longer available.' });
  if (car.isDemo) return res.status(400).json({ error: 'Sample listings cannot receive enquiries.' });
  if (car.seller === req.user.id) return res.status(400).json({ error: 'You cannot enquire about your own listing.' });
  const type = req.body?.type === 'contact' ? 'contact' : 'purchase';
  const message = typeof req.body?.message === 'string' ? req.body.message.trim().slice(0, 500) : '';
  const id = createId();
  await execute(
    'INSERT INTO purchase_enquiries (id, buyer_id, car_id, type, message) VALUES (?, ?, ?, ?, ?)',
    [id, req.user.id, car.id, type, message]
  );
  await logActivity('Enquiry received', `${type === 'contact' ? 'Contact request' : 'Purchase enquiry'} received for ${car.brand} ${car.model}.`);
  res.status(201).json({ enquiry: { id, status: 'Pending' }, message: 'Your request was sent to the seller.' });
}

export async function listMyEnquiries(req, res) {
  const enquiries = await query(`SELECT e.id, e.type, e.message, e.status, e.created_at AS createdAt,
    c.id AS carId, c.brand, c.model, c.year, c.price, c.photos,
    c.seller_name AS sellerName, c.seller_phone AS sellerPhone
    FROM purchase_enquiries e JOIN cars c ON c.id = e.car_id
    WHERE e.buyer_id = ? ORDER BY e.created_at DESC`, [req.user.id]);
  res.json({ enquiries: enquiries.map((item) => ({
    id: String(item.id), type: item.type, message: item.message, status: item.status,
    created_at: toISOString(item.createdAt), car_id: String(item.carId), brand: item.brand,
    model: item.model, year: item.year, price: item.price,
    photos: typeof item.photos === 'string' ? JSON.parse(item.photos) : item.photos,
    seller_name: item.sellerName, seller_phone: item.sellerPhone
  })) });
}

export async function listAdminEnquiries(req, res) {
  const where = [];
  const values = [];
  if (statuses.includes(req.query.status)) {
    where.push('e.status = ?');
    values.push(req.query.status);
  }
  const enquiries = await query(`SELECT e.id, e.type, e.message, e.status, e.created_at AS createdAt,
    u.name AS buyerName, u.email AS buyerEmail, u.phone AS buyerPhone,
    c.id AS carId, c.brand, c.model, c.seller_name AS sellerName, c.seller_phone AS sellerPhone
    FROM purchase_enquiries e JOIN users u ON u.id = e.buyer_id JOIN cars c ON c.id = e.car_id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY e.created_at DESC`, values);
  res.json({ enquiries: enquiries.map((item) => ({
    id: String(item.id), type: item.type, message: item.message, status: item.status,
    created_at: toISOString(item.createdAt), buyer_name: item.buyerName,
    buyer_email: item.buyerEmail, buyer_phone: item.buyerPhone,
    car_id: String(item.carId), brand: item.brand, model: item.model,
    seller_name: item.sellerName, seller_phone: item.sellerPhone
  })) });
}

export async function updateEnquiryStatus(req, res) {
  const { status } = req.body || {};
  if (!statuses.includes(status)) return res.status(400).json({ error: 'Invalid enquiry status.' });
  if (!isValidId(req.params.id)) return res.status(404).json({ error: 'Enquiry not found.' });
  const enquiry = transaction(() => {
    const [found] = query(`SELECT e.id, e.type, e.car_id AS carId
      FROM purchase_enquiries e WHERE e.id = ?`, [req.params.id]);
    if (!found) return null;
    if (status === 'Completed' && found.type === 'purchase') {
      execute('UPDATE cars SET status = ? WHERE id = ? AND status = ?', ['sold', found.carId, 'approved']);
    }
    execute('UPDATE purchase_enquiries SET status = ? WHERE id = ?', [status, found.id]);
    return found;
  });
  if (!enquiry) return res.status(404).json({ error: 'Enquiry not found.' });
  await logActivity('Enquiry status updated', `Admin changed an enquiry to ${status}.`);
  res.json({ status });
}
