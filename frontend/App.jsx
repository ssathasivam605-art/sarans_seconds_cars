import { createContext, useContext, useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowDownUp, ArrowRight, BadgeCheck, CarFront, Check, ChevronDown, ChevronLeft, ChevronRight, CircleUserRound, Fuel, Gauge, Heart, KeyRound, MapPin, Menu, MessageCircle, Search, ShieldCheck, SlidersHorizontal, Sparkles, Star, Users, X } from 'lucide-react';
import { api, json } from './api.js';

const AuthContext = createContext(null);
const useAuth = () => useContext(AuthContext);
const fallbackImage = '/cars/image-unavailable.svg';
const handleImageError = (event) => {
  event.currentTarget.onerror = null;
  event.currentTarget.src = fallbackImage;
};
const currency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [notice, setNotice] = useState('');
  useEffect(() => {
    api('/auth/me')
      .then(({ user: current }) => setUser(current))
      .catch((error) => {
        setUser(null);
        if (error.status !== 401) setNotice(error.message);
      })
      .finally(() => setAuthLoading(false));
  }, []);
  useEffect(() => {
    if (!user) { setFavoriteIds(new Set()); return; }
    api('/favourites').then(({ cars }) => setFavoriteIds(new Set(cars.map((car) => car.id)))).catch((error) => {
      setNotice(error.message);
      window.setTimeout(() => setNotice(''), 3600);
    });
  }, [user]);
  const signIn = (current) => { setUser(current); };
  const signOut = async () => {
    try { await api('/auth/logout', { method: 'POST' }); setUser(null); window.location.assign('/'); }
    catch (error) { notify(error.message); }
  };
  const notify = (message) => { setNotice(message); window.setTimeout(() => setNotice(''), 3600); };
  const setFavorite = (id, saved) => setFavoriteIds((current) => {
    const updated = new Set(current);
    if (saved) updated.add(id); else updated.delete(id);
    return updated;
  });
  return <AuthContext.Provider value={{ user, signIn, signOut, notify, favoriteIds, setFavorite, updateUser: setUser, authLoading }}>
    <div className="app-shell">
      <Header />
      <main><Routes>
        <Route path="/" element={<Home />} />
        <Route path="/buy" element={<BuyCars />} />
        <Route path="/cars/:id" element={<CarDetails />} />
        <Route path="/sell" element={<SellCar />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/register" element={<AuthPage register />} />
        <Route path="/admin/login" element={<AuthPage admin />} />
        <Route path="/profile" element={<Protected><Profile /></Protected>} />
        <Route path="/my-listings" element={<Protected><MyListings /></Protected>} />
        <Route path="/favourites" element={<Protected><MyFavourites /></Protected>} />
        <Route path="/enquiries" element={<Protected><MyEnquiries /></Protected>} />
        <Route path="/admin/*" element={<AdminProtected><AdminDashboard /></AdminProtected>} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="*" element={<NotFound />} />
      </Routes></main>
      <Footer />
      {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  </AuthContext.Provider>;
}

function Header() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  return <header className="site-header">
    <div className="container nav-wrap">
      <Link className="brand" to="/" aria-label="Saran Cars home"><span className="brand-icon"><CarFront size={24} /></span><span>SARAN <b>CARS</b></span></Link>
      <button className="mobile-toggle icon-button" aria-label="Toggle navigation" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
      <nav className={open ? 'main-nav open' : 'main-nav'} aria-label="Main navigation">
        <NavLink to="/" onClick={() => setOpen(false)}>Home</NavLink><NavLink to="/buy" onClick={() => setOpen(false)}>Buy Cars</NavLink><NavLink to="/sell" onClick={() => setOpen(false)}>Sell Your Car</NavLink><NavLink to="/about" onClick={() => setOpen(false)}>About Us</NavLink><NavLink to="/contact" onClick={() => setOpen(false)}>Contact</NavLink>
      </nav>
      <div className="nav-actions">
        {user ? <div className="user-menu"><Link to={user.role === 'admin' ? '/admin/dashboard' : '/profile'} className="user-link"><CircleUserRound size={19} /> {user.name.split(' ')[0]}</Link><button className="text-button" onClick={signOut}>Log out</button></div> :
          <><Link className="login-link" to="/login">Log in</Link><Link className="button button-small" to="/register">Get started <ArrowRight size={15} /></Link></>}
      </div>
    </div>
  </header>;
}

function Footer() {
  return <footer className="footer"><div className="container footer-grid">
    <div><Link className="brand footer-brand" to="/"><span className="brand-icon"><CarFront size={23} /></span><span>SARAN <b>CARS</b></span></Link><p>A better way to buy and sell your next car. Local cars, honest details, and a team here to help.</p></div>
    <div><h4>Explore</h4><Link to="/buy">Browse cars</Link><Link to="/sell">Sell your car</Link><Link to="/about">About Saran Cars</Link></div>
    <div><h4>Get in touch</h4><a href="mailto:hello@sarancars.example">hello@sarancars.example</a><a href="tel:+914440001234">+91 44 4000 1234</a><Link to="/contact">Contact us</Link></div>
    <div className="footer-note"><span className="sample-pill">DEMO MARKETPLACE</span><p>Vehicle records marked as sample are illustrative. Availability and vehicle details must be confirmed with the seller.</p><Link to="/admin/login">Administrator sign in</Link></div>
  </div><div className="container footer-bottom"><span>© {new Date().getFullYear()} Saran Cars</span><span>Built for confident car journeys.</span></div></footer>;
}

function CarCard({ car, compact = false }) {
  const { user, notify, favoriteIds, setFavorite } = useAuth();
  const saved = favoriteIds.has(car.id);
  const [busy, setBusy] = useState(false);
  const image = car.photos?.[0] || fallbackImage;
  async function toggleFavourite(event) {
    event.preventDefault(); event.stopPropagation();
    if (!user) { notify('Please log in to save cars to your favourites.'); return; }
    setBusy(true);
    try {
      await api(`/favourites/${car.id}`, json(saved ? 'DELETE' : 'PUT', {}));
      setFavorite(car.id, !saved); notify(saved ? 'Removed from favourites.' : 'Added to favourites.');
    } catch (error) { notify(error.message); } finally { setBusy(false); }
  }
  return <article className={`car-card ${compact ? 'compact-card' : ''}`}>
    <Link to={`/cars/${car.id}`} className="car-image-wrap"><img src={image} alt={`${car.year} ${car.brand} ${car.model}`} onError={handleImageError} loading="lazy" />
      <span className="car-year">{car.year}</span>{car.is_demo && <span className="sample-label">SAMPLE</span>}
    </Link>
    <button className={`favorite-button ${saved ? 'saved' : ''}`} onClick={toggleFavourite} disabled={busy} aria-label={saved ? 'Remove from favourites' : 'Save to favourites'}><Heart size={18} fill={saved ? 'currentColor' : 'none'} /></button>
    <div className="car-card-content"><div className="car-title-row"><div><span className="eyebrow">{car.brand === 'Tata' ? 'Tata Motors' : car.brand}</span><Link to={`/cars/${car.id}`}><h3>{car.model}</h3></Link></div><strong className="car-price">{currency(car.price)}</strong></div>
      <div className="car-specs"><span><Gauge size={15} /> {Number(car.mileage).toLocaleString('en-IN')} km</span><span><Fuel size={15} /> {car.fuel}</span><span><MapPin size={15} /> {car.location}</span></div>
      <div className="car-card-bottom"><span>{car.transmission} <i>·</i> {car.owners} owner{car.owners > 1 ? 's' : ''}</span><Link className="car-details-button" to={`/cars/${car.id}`}>View details <ArrowRight size={15} /></Link></div>
    </div>
  </article>;
}

function SectionHeading({ eyebrow, title, text, link, to = '/buy' }) {
  return <div className="section-heading"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2>{text && <p>{text}</p>}</div>{link && <Link className="text-arrow" to={to}>{link} <ArrowRight size={17} /></Link>}</div>;
}

function HomeCarGrid({ cars, loading, error, emptyMessage }) {
  if (loading) return <p className="section-empty" role="status">Loading cars…</p>;
  if (!cars.length && error) return <p className="section-error" role="alert">{error}</p>;
  if (!cars.length) return <p className="section-empty" role="status">{emptyMessage}</p>;
  return <div className="car-grid">{cars.map((car) => <CarCard key={car.id} car={car} />)}</div>;
}

function Home() {
  const [featured, setFeatured] = useState([]);
  const [latest, setLatest] = useState([]);
  const [premium, setPremium] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [carsLoading, setCarsLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [budget, setBudget] = useState('');
  const [fuel, setFuel] = useState('');
  const [year, setYear] = useState('');
  useEffect(() => {
    const requests = [
      api('/cars?limit=4&featured=true&sort=price_asc').then(({ cars }) => setFeatured(cars)),
      api('/cars?limit=4&sort=recent').then(({ cars }) => setLatest(cars)),
      api('/cars?limit=4&minPrice=1500000&sort=price_desc').then(({ cars }) => setPremium(cars))
    ];
    Promise.all(requests)
      .catch((error) => setLoadError(error.message))
      .finally(() => setCarsLoading(false));
  }, []);
  function search(e) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (budget) params.set('maxPrice', budget);
    if (fuel) params.set('fuel', fuel);
    if (year) params.set('minYear', year);
    window.location.assign(`/buy?${params.toString()}`);
  }
  return <>
    <section className="hero"><div className="container hero-layout"><div className="hero-copy"><span className="hero-kicker"><Sparkles size={15} /> THE CAR YOU WANT, THE WAY YOU WANT IT</span><h1>Find your perfect <span>pre-owned car.</span></h1><p>Buy and sell quality used cars with confidence. Discover thoughtfully chosen cars from sellers near you.</p>
      <div className="hero-ctas"><Link className="button" to="/buy">Explore cars <ArrowRight size={18} /></Link><Link className="button button-light" to="/sell">Sell your car</Link></div>
      <div className="hero-trust"><span><ShieldCheck size={17} /> Verified seller details</span><span><BadgeCheck size={17} /> No hidden surprises</span></div></div>
      <div className="hero-visual"><img src="/cars/mahindra-thar.jpg" alt="Mahindra Thar SUV parked on a beach" onError={handleImageError} /><div className="hero-float-card"><span className="float-icon"><Check size={18} /></span><div><b>Find with confidence</b><small>Clear details, local sellers</small></div></div></div>
    </div></section>
    <section className="search-panel-section"><div className="container"><form className="search-panel" onSubmit={search}><div className="search-title"><span className="search-icon"><Search size={19} /></span><div><b>What are you looking for?</b><small>Find a car that fits your life.</small></div></div><label className="search-input"><span>Brand or model</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. Hyundai Creta" /></label><label className="search-input"><span>Price range</span><select aria-label="Maximum budget" value={budget} onChange={(e) => setBudget(e.target.value)}><option value="">Any budget</option><option value="500000">Under ₹5 lakh</option><option value="1000000">Under ₹10 lakh</option><option value="2000000">Under ₹20 lakh</option></select></label><label className="search-input"><span>Fuel type</span><select aria-label="Fuel type" value={fuel} onChange={(e) => setFuel(e.target.value)}><option value="">Any fuel</option><option>Petrol</option><option>Diesel</option><option>Electric</option></select></label><label className="search-input search-year"><span>Year from</span><input aria-label="Minimum manufacturing year" type="number" min="1950" max={new Date().getFullYear()+1} value={year} onChange={(e) => setYear(e.target.value)} placeholder="Any year" /></label><button className="button search-submit"><Search size={17} /> Search cars</button></form></div></section>
    <section className="section container"><SectionHeading eyebrow="HANDPICKED FOR YOU" title="Featured cars" text="A few standouts to get your search started." link="Explore all cars" /><HomeCarGrid cars={featured} loading={carsLoading} error={loadError} emptyMessage="No featured cars are available yet. Browse all approved listings to see what’s available." /></section>
    <section className="section section-soft"><div className="container"><SectionHeading eyebrow="JUST ARRIVED" title="Latest arrivals" text="Fresh finds added to the marketplace." link="See all arrivals" /><HomeCarGrid cars={latest} loading={carsLoading} error={loadError} emptyMessage="There are no approved listings yet. Check back soon or add a listing." /></div></section>
    <section className="section container"><SectionHeading eyebrow="MAKE IT YOURS" title="Explore by budget" text="Start with a number that feels right." /><div className="budget-grid">{[['Under ₹3 lakh','A smart first car','300000'],['Under ₹7 lakh','Room for every day','700000'],['Under ₹15 lakh','A little more to love','1500000']].map(([title,sub,max]) => <Link className="budget-card" to={`/buy?maxPrice=${max}`} key={max}><span>{title}</span><b>{sub}</b><ArrowRight size={20} /></Link>)}</div></section>
    <section className="section section-soft"><div className="container"><SectionHeading eyebrow="A STEP UP" title="Premium cars" text="Explore higher-end options from the sample marketplace." link="Browse premium cars" to="/buy?minPrice=1500000" /><HomeCarGrid cars={premium} loading={carsLoading} error={loadError} emptyMessage="No premium listings are available yet." /></div></section>
    <section className="section brand-showcase-section"><div className="container"><SectionHeading eyebrow="EXPLORE BY BRAND" title="Find a make that moves you" text="Browse familiar favourites and discover our electric collection." link="View all cars" /><div className="brand-showcase-grid">{[
      { name: 'Toyota', brand: 'Toyota', image: '/cars/toyota-urban-cruiser-hyryder.jpg', detail: 'Reliable journeys, every day' },
      { name: 'Mahindra', brand: 'Mahindra', image: '/cars/mahindra-thar.jpg', detail: 'Built for the road ahead' },
      { name: 'Maruti Suzuki', brand: 'Maruti Suzuki', image: '/cars/maruti-swift.jpg', detail: 'Everyday cars, made smarter' },
      { name: 'Hyundai', brand: 'Hyundai', image: '/cars/hyundai-creta.jpg', detail: 'Comfort meets confidence' },
      { name: 'Tata Motors', brand: 'Tata', image: '/cars/tata-punch.jpg', detail: 'Indian engineering, made for you' },
      { name: 'Electric Vehicles', fuel: 'Electric', image: '/cars/tata-nexon-ev.png', detail: 'Explore the electric lineup' }
    ].map(({ name, brand, fuel: brandFuel, image: brandImage, detail }) => {
      const params = new URLSearchParams();
      if (brand) params.set('brand', brand);
      if (brandFuel) params.set('fuel', brandFuel);
      return <Link className="brand-showcase-card" key={name} to={`/buy?${params.toString()}`}>
        <img src={brandImage} alt="" loading="lazy" onError={handleImageError} />
        <span className="brand-showcase-copy"><span className="brand-showcase-detail">{detail}</span><b>{name}</b><span className="brand-showcase-action">View cars <ArrowRight size={15} /></span></span>
      </Link>;
    })}</div><p className="brand-demo-note">Sample marketplace data for demonstration only. Listings and prices are illustrative, not verified offers.</p></div></section>
    <section className="section container"><div className="why-layout"><div><span className="eyebrow">A BETTER WAY TO BUY</span><h2>Good cars. Clear information. A little more peace of mind.</h2><p className="muted">A used car purchase should feel exciting—not overwhelming. We make it easier to explore your options and connect with sellers.</p><Link className="text-arrow" to="/about">Why Saran Cars <ArrowRight size={17} /></Link></div><div className="why-cards"><Feature icon={<ShieldCheck />} title="Confidence first" text="Clear listing details and direct seller contact, all in one place." /><Feature icon={<Users />} title="Local connections" text="Explore cars offered by people and dealers in your community." /><Feature icon={<Heart />} title="Your shortlist" text="Save the cars you love and compare them on your own time." /></div></div></section>
    <section className="section section-soft"><div className="container"><SectionHeading eyebrow="THREE SIMPLE STEPS" title="Your next car, made simpler." /><div className="steps-grid"><Step n="01" title="Explore" text="Search cars by brand, budget, fuel, and more." /><Step n="02" title="Connect" text="Ask the seller questions and arrange a viewing." /><Step n="03" title="Decide" text="Verify the details, then make the decision that's right for you." /></div></div></section>
    <section className="section container"><div className="testimonial"><div className="testimonial-stars"><Star /><Star /><Star /><Star /><Star /></div><blockquote>“The search was straightforward, and I could reach the seller directly. It made finding my next car feel a lot less complicated.”</blockquote><div className="testimonial-author"><span className="avatar">AK</span><div><b>Arun K.</b><small>Chennai · Saran Cars community</small></div></div><small className="demo-disclaimer">Sample testimonial for website demonstration.</small></div></section>
    <section className="bottom-cta"><div className="container bottom-cta-inner"><div><span className="eyebrow">READY FOR YOUR NEXT JOURNEY?</span><h2>Let's find a car that feels right.</h2></div><Link className="button button-white" to="/buy">Browse all cars <ArrowRight size={18} /></Link></div></section>
  </>;
}

function Feature({ icon, title, text }) { return <div className="feature"><span className="feature-icon">{icon}</span><div><h3>{title}</h3><p>{text}</p></div></div>; }
function Step({ n, title, text }) { return <article className="step"><span>{n}</span><h3>{title}</h3><p>{text}</p></article>; }

function BuyCars() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [cars, setCars] = useState([]); const [total, setTotal] = useState(0); const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [view, setView] = useState('grid');
  const [filters, setFilters] = useState({ q: searchParams.get('q') || '', brand: searchParams.get('brand') || '', fuel: searchParams.get('fuel') || '', transmission: '', location: '', minYear: searchParams.get('minYear') || '', maxYear: '', minPrice: searchParams.get('minPrice') || '', maxPrice: searchParams.get('maxPrice') || '', minMileage: '', maxMileage: '', sort: searchParams.get('sort') || 'newest', page: '1' });
  useEffect(() => { const params = new URLSearchParams(Object.entries(filters).filter(([,v]) => v)); setSearchParams(params, { replace: true }); setLoading(true); setError('');
    api(`/cars?${params.toString()}&limit=9`).then((data) => { setCars(data.cars); setTotal(data.total); setPages(data.pages); }).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [filters, setSearchParams]);
  const change = (key) => (e) => setFilters((current) => ({ ...current, [key]: e.target.value, page: '1' }));
  function reset() { setFilters({ q: '', brand: '', fuel: '', transmission: '', location: '', minYear: '', maxYear: '', minPrice: '', maxPrice: '', minMileage: '', maxMileage: '', sort: 'newest', page: '1' }); }
  return <div className="container page-wrap">
    <div className="page-intro"><div><span className="eyebrow">THE MARKETPLACE</span><h1>Find a car you'll love.</h1><p>Browse local listings and connect directly with sellers.</p></div><span className="sample-pill">SAMPLE LISTINGS INCLUDED</span></div>
    <div className="buy-layout"><aside className="filter-panel"><div className="filter-title"><SlidersHorizontal size={18} /><b>Filter cars</b><button className="text-button" onClick={reset}>Reset</button></div>
      <label className="filter-field"><span>Search</span><div className="input-icon"><Search size={16} /><input value={filters.q} onChange={change('q')} placeholder="Brand or model" /></div></label>
      <label className="filter-field"><span>Brand</span><select value={filters.brand} onChange={change('brand')}><option value="">All brands</option>{[['Maruti Suzuki','Maruti Suzuki'],['Hyundai','Hyundai'],['Tata Motors','Tata'],['Honda','Honda'],['Toyota','Toyota'],['Mahindra','Mahindra'],['MG','MG'],['Kia','Kia'],['Renault','Renault'],['Volkswagen','Volkswagen'],['Skoda','Skoda'],['BMW','BMW'],['Mercedes-Benz','Mercedes-Benz'],['Audi','Audi']].map(([label, value]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <div className="filter-two"><label className="filter-field"><span>Price from</span><input type="number" min="0" placeholder="₹ min" value={filters.minPrice} onChange={change('minPrice')} /></label><label className="filter-field"><span>Price to</span><input type="number" min="0" placeholder="₹ max" value={filters.maxPrice} onChange={change('maxPrice')} /></label></div>
      <div className="filter-two"><label className="filter-field"><span>Year from</span><input type="number" min="1950" max="2027" placeholder="Year" value={filters.minYear} onChange={change('minYear')} /></label><label className="filter-field"><span>Year to</span><input type="number" min="1950" max="2027" placeholder="Year" value={filters.maxYear} onChange={change('maxYear')} /></label></div>
      <div className="filter-two"><label className="filter-field"><span>From kilometres</span><input type="number" min="0" placeholder="Min km" value={filters.minMileage} onChange={change('minMileage')} /></label><label className="filter-field"><span>To kilometres</span><input type="number" min="0" placeholder="Max km" value={filters.maxMileage} onChange={change('maxMileage')} /></label></div>
      <label className="filter-field"><span>Fuel type</span><select value={filters.fuel} onChange={change('fuel')}><option value="">All fuel types</option>{['Petrol','Diesel','CNG','Electric','Hybrid'].map((f) => <option key={f}>{f}</option>)}</select></label>
      <label className="filter-field"><span>Transmission</span><select value={filters.transmission} onChange={change('transmission')}><option value="">Any transmission</option><option>Manual</option><option>Automatic</option></select></label>
      <label className="filter-field"><span>Location</span><input value={filters.location} onChange={change('location')} placeholder="City" /></label>
    </aside><section className="results-area">
      <div className="results-toolbar"><p><b>{total}</b> cars to explore</p><div className="toolbar-actions"><label className="sort-select"><ArrowDownUp size={16} /><select value={filters.sort} onChange={change('sort')}><option value="newest">Newest year first</option><option value="oldest">Oldest year first</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option></select><ChevronDown size={14} /></label><div className="view-toggle"><button aria-label="Grid view" className={view === 'grid' ? 'selected' : ''} onClick={() => setView('grid')}>▦</button><button aria-label="List view" className={view === 'list' ? 'selected' : ''} onClick={() => setView('list')}>☷</button></div></div></div>
      {loading ? <div className="loading-state">Finding cars for you…</div> : error ? <div className="empty-state"><h3>We couldn't load the cars</h3><p>{error}</p><button className="button" onClick={() => setFilters({ ...filters })}>Try again</button></div> : cars.length ? <><div className={view === 'grid' ? 'car-grid' : 'car-grid list-view'}>{cars.map((car) => <CarCard car={car} key={car.id} />)}</div>
        {pages > 1 && <div className="pagination"><button disabled={Number(filters.page) <= 1} onClick={() => setFilters({ ...filters, page: String(Number(filters.page) - 1) })}><ChevronLeft size={17} /> Previous</button><span>Page {filters.page} of {pages}</span><button disabled={Number(filters.page) >= pages} onClick={() => setFilters({ ...filters, page: String(Number(filters.page) + 1) })}>Next <ChevronRight size={17} /></button></div>}</> : <div className="empty-state"><span className="empty-icon"><Search size={26} /></span><h3>No cars match those filters</h3><p>Try a different search or clear some filters.</p><button className="button button-outline" onClick={reset}>Clear filters</button></div>}
    </section></div></div>;
}

function CarDetails() {
  const { id } = useParams(); const { user, notify } = useAuth(); const [car, setCar] = useState(null); const [similar, setSimilar] = useState([]); const [error, setError] = useState(''); const [photo, setPhoto] = useState(0); const [busy, setBusy] = useState(false);
  useEffect(() => { api(`/cars/${id}`).then((data) => { setCar(data.car); setSimilar(data.similar); }).catch((e) => setError(e.message)); }, [id]);
  async function enquire(type) {
    if (!user) { notify('Please log in to contact a seller or request a purchase.'); window.location.assign(`/login?next=/cars/${id}`); return; }
    setBusy(true); try { const result = await api(`/cars/${id}/enquiries`, json('POST', { type })); notify(result.message); } catch (e) { notify(e.message); } finally { setBusy(false); }
  }
  if (error) return <div className="container page-wrap"><div className="empty-state"><h2>Car unavailable</h2><p>{error}</p><Link className="button" to="/buy">Browse cars</Link></div></div>;
  if (!car) return <div className="container page-wrap loading-state">Loading car details…</div>;
  const photos = car.photos?.length ? car.photos : [fallbackImage];
  return <div className="container page-wrap detail-page"><Link to="/buy" className="back-link"><ChevronLeft size={17} /> Back to cars</Link>
    {car.is_demo && <div className="demo-notice"><ShieldCheck size={18} /><span><b>Sample listing.</b> This vehicle is provided as illustrative demo data. It may not be available for sale. Verify availability and all vehicle details directly with the seller.</span></div>}
    <div className="detail-layout"><div><div className="detail-photo"><img src={photos[photo]} alt={`${car.year} ${car.brand} ${car.model}`} onError={handleImageError} /><span className="car-year">{car.year}</span></div><div className="photo-thumbs">{photos.map((src, i) => <button key={src + i} className={photo === i ? 'active' : ''} onClick={() => setPhoto(i)} aria-label={`View photo ${i + 1}`}><img src={src} alt="" onError={handleImageError} /></button>)}</div>
      <div className="detail-card"><h2>About this car</h2><p>{car.description}</p><h3>Specifications</h3><div className="spec-grid">{[['Manufacturing year',car.year],['Kilometres driven',`${Number(car.mileage).toLocaleString('en-IN')} km`],['Fuel type',car.fuel],['Transmission',car.transmission],['Previous owners',car.owners],['Registration city',car.location]].map(([label,value]) => <div key={label}><small>{label}</small><b>{value}</b></div>)}</div></div></div>
      <aside className="seller-panel"><span className="eyebrow">{car.brand === 'Tata' ? 'Tata Motors' : car.brand}</span><h1>{car.model}</h1><p className="detail-location"><MapPin size={16} /> {car.location}</p><strong className="detail-price">{currency(car.price)}</strong><span className="price-caption">Listed price · confirm details with seller</span><div className="seller-info"><span className="seller-avatar"><Users size={21} /></span><div><small>SELLER</small><b>{car.seller_name}</b><small>{car.seller_id ? 'Community seller' : 'Saran Cars demo seller'}</small></div></div>
        <button className="button full-button" disabled={busy || car.is_demo} onClick={() => enquire('contact')}><MessageCircle size={17} /> Contact seller</button><button className="button button-outline full-button" disabled={busy || car.is_demo} onClick={() => enquire('purchase')}><KeyRound size={17} /> Request to purchase</button>
        {car.is_demo && <p className="demo-caution">Enquiry actions are disabled for sample records. Browse real user-submitted listings to contact sellers.</p>}
        <div className="safety-note"><ShieldCheck size={17} /><span>Meet safely, inspect the car, and verify documents before making a payment.</span></div></aside></div>
    {similar.length > 0 && <section className="section"><SectionHeading eyebrow="MORE TO EXPLORE" title="Similar cars" link="View all cars" /><div className="car-grid">{similar.map((item) => <CarCard key={item.id} car={item} />)}</div></section>}
  </div>;
}

function Protected({ children }) { const { user, authLoading } = useAuth(); return authLoading ? <div className="container page-wrap loading-state">Checking your session…</div> : user ? children : <SignInPrompt />; }
function AdminProtected({ children }) { const { user, authLoading } = useAuth(); return authLoading ? <div className="container page-wrap loading-state">Checking administrator access…</div> : user?.role === 'admin' ? children : <SignInPrompt admin />; }
function SignInPrompt({ admin = false }) { return <div className="container page-wrap"><div className="empty-state"><span className="empty-icon"><KeyRound size={25} /></span><h2>{admin ? 'Administrator access required' : 'Sign in to continue'}</h2><p>{admin ? 'This area is available to authorized administrators only.' : 'Log in or create an account to access this page.'}</p><Link className="button" to={admin ? '/admin/login' : '/login'}>{admin ? 'Admin log in' : 'Log in'}</Link></div></div>; }

function AuthPage({ register = false, admin = false }) {
  const { signIn, notify } = useAuth(); const navigate = useNavigate(); const [searchParams] = useSearchParams(); const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' }); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      const data = await api(register ? '/auth/register' : '/auth/login', json('POST', form));
      if (admin && data.user.role !== 'admin') { setError('This account does not have administrator access.'); return; }
      signIn(data.user); notify(register ? 'Your account is ready.' : 'Welcome back.');
      navigate(admin ? '/admin/dashboard' : searchParams.get('next') || (data.user.role === 'admin' ? '/admin/dashboard' : '/profile'));
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <div className="auth-page"><div className="auth-card"><div className="auth-heading"><span className="brand-icon"><CarFront size={24} /></span><span className="eyebrow">{admin ? 'ADMINISTRATOR ACCESS' : register ? 'JOIN THE COMMUNITY' : 'WELCOME BACK'}</span><h1>{admin ? 'Admin sign in' : register ? 'Create your account' : 'Good to see you again.'}</h1><p>{admin ? 'Sign in using your authorized administrator account.' : register ? 'Save favourites, contact sellers, and list your car.' : 'Sign in to pick up where you left off.'}</p></div>
    {error && <div className="form-error" role="alert">{error}</div>}<form className="form-stack" onSubmit={submit}>
      {register && <label>Full name<input required autoComplete="name" maxLength="80" value={form.name} onChange={(e) => setForm({ ...form,name:e.target.value })} placeholder="Your name" /></label>}
      <label>Email address<input required type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form,email:e.target.value })} placeholder="you@example.com" /></label>
      {register && <label>Phone number<input required type="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form,phone:e.target.value })} placeholder="+91 98765 43210" /></label>}
      <label>Password<input required type="password" autoComplete={register ? 'new-password' : 'current-password'} minLength={register ? 8 : undefined} value={form.password} onChange={(e) => setForm({ ...form,password:e.target.value })} placeholder={register ? 'At least 8 characters' : 'Enter your password'} /></label>
      <button className="button full-button" disabled={busy}>{busy ? 'Please wait…' : admin ? 'Sign in securely' : register ? 'Create account' : 'Log in'} <ArrowRight size={17} /></button>
    </form>
    {!admin && <p className="auth-switch">{register ? 'Already have an account?' : 'New to Saran Cars?'} <Link to={register ? '/login' : '/register'}>{register ? 'Log in' : 'Create an account'}</Link></p>}
  </div></div>;
}

function SellCar() {
  const { user, notify } = useAuth(); const [params] = useSearchParams(); const editId = params.get('edit'); const [editCar,setEditCar] = useState(null); const [busy,setBusy] = useState(false); const [error,setError] = useState(''); const [done,setDone] = useState(false);
  useEffect(() => { if (editId) api(`/cars/${editId}/mine`).then((result) => setEditCar(result.car)).catch((e) => setError(e.message)); }, [editId]);
  if (!user) return <SignInPrompt />;
  if (editId && !editCar && !error) return <div className="container page-wrap loading-state">Loading your listing…</div>;
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    const form = new FormData(e.currentTarget);
    if (editCar) form.append('retainedPhotos', JSON.stringify(editCar.photos || []));
    const formElement = e.currentTarget;
    try { const data = await api(editCar ? `/cars/${editCar.id}` : '/cars', { method:editCar ? 'PATCH' : 'POST', body:form }); setDone(true); notify(data.message); if (!editCar) formElement.reset(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <div className="container page-wrap sell-page"><div className="page-intro"><div><span className="eyebrow">SELL WITH SARAN CARS</span><h1>{editCar ? 'Update your car listing.' : "Ready for your car's next chapter?"}</h1><p>Share the details below. Your listing will be reviewed before it appears publicly.</p></div><div className="sell-promise"><ShieldCheck size={22} /><span><b>Your listing, your control</b><small>Pending listings stay private until approved.</small></span></div></div>
    {done && <div className="success-banner" role="status"><Check size={18} /> {editCar ? 'Changes saved and sent for approval.' : 'Listing submitted for approval.'} Track it in <Link to="/my-listings">My listings</Link>.</div>}
    {error && <div className="form-error" role="alert">{error}</div>}
    <form className="listing-form" onSubmit={submit}>
      <div className="form-section"><h2>About the car</h2><p>Be accurate—buyers appreciate the details.</p><div className="form-grid">
        <label>Brand <input name="brand" required maxLength="60" placeholder="e.g. Maruti Suzuki" defaultValue={editCar?.brand || ''} /></label><label>Model <input name="model" required maxLength="80" placeholder="e.g. Swift ZXi" defaultValue={editCar?.model || ''} /></label>
        <label>Manufacturing year <input name="year" required type="number" min="1950" max={new Date().getFullYear()+1} placeholder="e.g. 2021" defaultValue={editCar?.year || ''} /></label><label>Expected price (₹) <input name="price" required type="number" min="10000" max="100000000" placeholder="e.g. 650000" defaultValue={editCar?.price || ''} /></label>
        <label>Kilometres driven <input name="mileage" required type="number" min="0" max="2000000" placeholder="e.g. 32000" defaultValue={editCar?.mileage || ''} /></label><label>Fuel type <select name="fuel" required defaultValue={editCar?.fuel || ''}><option value="" disabled>Select fuel</option>{['Petrol','Diesel','CNG','Electric','Hybrid'].map((f) => <option key={f}>{f}</option>)}</select></label>
        <label>Transmission <select name="transmission" required defaultValue={editCar?.transmission || ''}><option value="" disabled>Select transmission</option><option>Manual</option><option>Automatic</option></select></label><label>Previous owners <select name="owners" required defaultValue={editCar?.owners || '1'}>{[1,2,3,4,5].map((n) => <option key={n} value={n}>{n} owner{n > 1 ? 's' : ''}</option>)}</select></label>
        <label>Registration city <input name="location" required maxLength="80" placeholder="e.g. Chennai" defaultValue={editCar?.location || ''} /></label><label>Seller name <input name="seller_name" required maxLength="80" defaultValue={editCar?.seller_name || user.name} /></label><label>Seller phone <input name="seller_phone" type="tel" required defaultValue={editCar?.seller_phone || user.phone} /></label>
        <label className="span-two">Description <textarea name="description" required minLength="15" maxLength="2000" rows="5" placeholder="Tell buyers about the condition, service history, and features…" defaultValue={editCar?.description || ''} /></label>
        <label className="span-two upload-field">Car photos <input name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple required={!editCar} /><small>Up to 8 JPG, PNG, or WebP photos. Maximum 5 MB per image. Existing photos stay attached when editing.</small></label>
      </div></div>
      <div className="form-submit"><p><ShieldCheck size={16} /> Your listing status will be <b>Pending approval</b> after submission.</p><button className="button" disabled={busy}>{busy ? 'Saving…' : editCar ? 'Save changes' : 'Submit for review'} <ArrowRight size={17} /></button></div>
    </form>
  </div>;
}

function Profile() {
  const { user, notify, updateUser } = useAuth(); const [form,setForm] = useState({ name:user.name, phone:user.phone }); const [error,setError] = useState(''); const [saved,setSaved] = useState(false);
  async function submit(e) { e.preventDefault(); setError(''); try { const result = await api('/auth/profile',json('PATCH',form)); updateUser(result.user); notify('Profile updated.'); setSaved(true); } catch (err) { setError(err.message); } }
  return <div className="container page-wrap narrow-page"><div className="page-intro"><div><span className="eyebrow">YOUR ACCOUNT</span><h1>Profile settings</h1><p>Keep your contact details up to date.</p></div></div><form className="panel form-stack" onSubmit={submit}>{error && <div className="form-error">{error}</div>}{saved && <div className="success-banner"><Check size={17} /> Your profile is up to date.</div>}<label>Full name<input required maxLength="80" value={form.name} onChange={(e) => setForm({...form,name:e.target.value})} /></label><label>Email address<input disabled value={user.email} /><small>Email address cannot currently be changed.</small></label><label>Phone number<input required type="tel" value={form.phone} onChange={(e) => setForm({...form,phone:e.target.value})} /></label><button className="button">Save changes</button><div className="profile-links"><Link to="/my-listings">My listings <ArrowRight size={16}/></Link><Link to="/favourites">Favourite cars <ArrowRight size={16}/></Link><Link to="/enquiries">Purchase enquiries <ArrowRight size={16}/></Link></div></form></div>;
}

function MyListings() {
  const [cars,setCars] = useState([]); const [error,setError] = useState(''); const [confirm,setConfirm] = useState(null); const { notify } = useAuth();
  const load = () => api('/cars/mine').then((r) => setCars(r.cars)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);
  async function remove(id) { try { await api(`/cars/${id}`,{method:'DELETE'}); setConfirm(null); notify('Listing removed.'); load(); } catch (e) { notify(e.message); } }
  return <div className="container page-wrap"><div className="page-intro"><div><span className="eyebrow">SELLER SPACE</span><h1>My listings</h1><p>Track your car submissions and approval status.</p></div><Link to="/sell" className="button">Add a listing <ArrowRight size={17} /></Link></div>
    {error ? <div className="form-error">{error}</div> : cars.length ? <div className="listing-table-wrap"><table><thead><tr><th>Car</th><th>Price</th><th>Status</th><th>Submitted</th><th>Actions</th></tr></thead><tbody>{cars.map((car) => <tr key={car.id}><td><div className="table-car"><img src={car.photos?.[0] || fallbackImage} alt="" onError={handleImageError} /><span><b>{car.brand} {car.model}</b><small>{car.year} · {car.location}</small></span></div></td><td>{currency(car.price)}</td><td><StatusBadge status={car.status} /></td><td>{new Date(car.created_at).toLocaleDateString('en-IN')}</td><td>{car.status === 'approved' && <Link className="table-link" to={`/cars/${car.id}`}>View</Link>}{!['sold','unavailable'].includes(car.status) && <Link className="table-link" to={`/sell?edit=${car.id}`}>Edit</Link>}<button className="table-link danger-text" onClick={() => setConfirm(car.id)}>Remove</button></td></tr>)}</tbody></table></div> : <div className="empty-state"><h3>No listings yet</h3><p>When you submit a car, its approval status will appear here.</p><Link to="/sell" className="button">List your car</Link></div>}
    {confirm && <ConfirmModal title="Remove this listing?" text="This cannot be undone. The listing will be removed from the marketplace." onCancel={() => setConfirm(null)} onConfirm={() => remove(confirm)} />}
  </div>;
}

function MyFavourites() {
  const [cars,setCars] = useState([]); const [error,setError] = useState('');
  useEffect(() => { api('/favourites').then((r) => setCars(r.cars)).catch((e) => setError(e.message)); }, []);
  return <div className="container page-wrap"><div className="page-intro"><div><span className="eyebrow">YOUR SHORTLIST</span><h1>Favourite cars</h1><p>Cars you saved for another look.</p></div></div>{error ? <div className="form-error">{error}</div> : cars.length ? <div className="car-grid">{cars.map((car) => <CarCard car={car} key={car.id} />)}</div> : <div className="empty-state"><span className="empty-icon"><Heart size={26} /></span><h3>Your shortlist is waiting</h3><p>Save a car you like and it will show up here.</p><Link className="button" to="/buy">Explore cars</Link></div>}</div>;
}

function MyEnquiries() {
  const [items,setItems] = useState([]); const [error,setError] = useState('');
  useEffect(() => { api('/enquiries').then((r) => setItems(r.enquiries)).catch((e) => setError(e.message)); }, []);
  return <div className="container page-wrap"><div className="page-intro"><div><span className="eyebrow">YOUR ACTIVITY</span><h1>My enquiries</h1><p>Follow up on the cars you asked about.</p></div></div>
    {error ? <div className="form-error">{error}</div> : items.length ? <div className="enquiry-list">{items.map((item) => <article className="enquiry-card" key={item.id}><img src={item.photos?.[0] || fallbackImage} alt="" onError={handleImageError} /><div><span className="eyebrow">{item.type === 'contact' ? 'CONTACT REQUEST' : 'PURCHASE REQUEST'} · {new Date(item.created_at).toLocaleDateString('en-IN')}</span><h3>{item.brand} {item.model} · {item.year}</h3><p>Seller: {item.seller_name} · {item.seller_phone}</p><Link to={`/cars/${item.car_id}`} className="table-link">View car</Link></div><StatusBadge status={item.status} /></article>)}</div> : <div className="empty-state"><h3>No enquiries yet</h3><p>When you contact a seller, your requests appear here.</p><Link className="button" to="/buy">Explore cars</Link></div>}
  </div>;
}

function StatusBadge({ status }) { const key = String(status || '').toLowerCase().replace(/\s+/g,'-'); return <span className={`status-badge status-${key}`}>{status}</span>; }
function ConfirmModal({ title, text, onCancel, onConfirm }) { return <div className="modal-backdrop" role="presentation" onClick={onCancel}><div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onClick={(e) => e.stopPropagation()}><span className="modal-icon"><ShieldCheck /></span><h3 id="confirm-title">{title}</h3><p>{text}</p><div><button className="button button-outline" onClick={onCancel}>Cancel</button><button className="button button-danger" onClick={onConfirm}>Confirm</button></div></div></div>; }

function AdminDashboard() {
  const nav = [
    ['dashboard','Dashboard'],['cars','Manage Cars'],['approvals','Pending Approvals'],
    ['users','Manage Users'],['sellers','Manage Sellers'],['enquiries','Customer Enquiries'],
    ['featured','Featured Cars'],['reports','Reports'],['settings','Settings']
  ];
  const [section,setSection] = useState(window.location.pathname.split('/')[2] || 'dashboard');
  const [stats,setStats] = useState(null); const [cars,setCars] = useState([]); const [users,setUsers] = useState([]); const [enquiries,setEnquiries] = useState([]); const [activities,setActivities] = useState([]); const [profile,setProfile] = useState(null); const [error,setError] = useState(''); const [query,setQuery] = useState(''); const [confirm,setConfirm] = useState(null); const [loading,setLoading] = useState(false); const { signOut,notify,updateUser } = useAuth(); const navigate = useNavigate();
  const [selectedUser,setSelectedUser] = useState(null);
  async function load(next=section, search=query) {
    setSection(next); setError(''); setLoading(true);
    try {
      if (['dashboard','reports'].includes(next)) { const [s,a] = await Promise.all([api('/admin/stats'),api('/admin/activities')]); setStats(s); setActivities(a.activities); }
      if (['cars','approvals','featured'].includes(next)) setCars((await api('/admin/cars')).cars);
      if (['users','sellers'].includes(next)) setUsers((await api(`/admin/users?q=${encodeURIComponent(search)}`)).users);
      if (next === 'enquiries') setEnquiries((await api('/admin/enquiries')).enquiries);
      if (next === 'settings') setProfile((await api('/auth/me')).user);
      navigate(`/admin/${next}`, { replace:true });
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }
  useEffect(() => { load(section); }, []);
  async function openUser(id) {
    setError('');
    try { setSelectedUser(await api(`/admin/users/${id}/cars`)); }
    catch(e) { setError(e.message); }
  }
  async function carAction(id, body, deletion = false) {
    try {
      await api(`/admin/cars/${id}`, deletion ? { method:'DELETE' } : { method:'PATCH', body });
      notify(deletion ? 'Listing deleted.' : 'Listing updated.'); setConfirm(null); await load(section);
    } catch(e) { notify(e.message); throw e; }
  }
  async function createCar(body) {
    try { await api('/admin/cars', { method:'POST', body }); notify('Car listing added and published.'); await load(section); }
    catch(e) { notify(e.message); throw e; }
  }
  async function userAction(id,active) { try { await api(`/admin/users/${id}`,json('PATCH',{active})); notify(`User ${active ? 'activated' : 'deactivated'}.`); await load(section); } catch(e) { notify(e.message); } }
  async function enquiryAction(id,status) { try { await api(`/admin/enquiries/${id}`,json('PATCH',{status})); notify('Enquiry status updated.'); await load('enquiries'); } catch(e) { notify(e.message); } }
  async function confirmAction() {
    if (confirm?.type === 'car') {
      try { await carAction(confirm.id, {}, true); } catch { /* The API error has already been reported. */ }
      return;
    }
    if (confirm?.type === 'user') {
      await userAction(confirm.id, false);
      setConfirm(null);
    }
  }
  async function saveProfile(event) {
    event.preventDefault();
    try { const result=await api('/auth/profile',json('PATCH',Object.fromEntries(new FormData(event.currentTarget)))); setProfile(result.user); updateUser(result.user); notify('Administrator profile updated.'); }
    catch(e) { setError(e.message); }
  }
  const statCards = [
    ['Total cars',stats?.listings,'Cars'],['Approved cars',stats?.availableCars,'Live'],
    ['Pending approvals',stats?.pendingCars,'Review'],['Rejected cars',stats?.rejectedCars,'Rejected'],
    ['Registered users',stats?.users,'Users'],['Sellers',stats?.sellers,'Sellers'],
    ['New enquiries',stats?.pendingEnquiries,'New'],['Sold cars',stats?.soldCars,'Sold']
  ];
  const visibleUsers = section === 'sellers' ? users.filter((user) => user.isSeller) : users;
  return <div className="admin-shell"><aside className="admin-sidebar"><Link className="brand admin-brand" to="/"><span className="brand-icon"><CarFront size={23} /></span><span>SARAN <b>CARS</b></span></Link><span className="admin-label">ADMIN CONSOLE</span><nav>{nav.map(([id,label]) => <button key={id} className={section === id ? 'active' : ''} onClick={() => load(id)}>{['dashboard','reports','settings'].includes(id) ? <SlidersHorizontal size={18} /> : ['cars','approvals','featured'].includes(id) ? <CarFront size={18} /> : ['users','sellers'].includes(id) ? <Users size={18} /> : <MessageCircle size={18} />}{label}</button>)}</nav><button className="admin-logout" onClick={signOut}>Sign out <ArrowRight size={16} /></button></aside>
    <section className="admin-content"><div className="admin-topbar"><div><span className="eyebrow">SARAN CARS / ADMIN</span><h1>{nav.find(([id]) => id === section)?.[1] || 'Dashboard'}</h1></div><Link to="/" className="table-link">View marketplace ↗</Link></div>
      {error && <div className="form-error" role="alert">{error}</div>}
      {loading && <div className="panel admin-loading" role="status">Loading marketplace data…</div>}
      {!loading && ['dashboard','reports'].includes(section) && <><div className="stats-grid">{statCards.map(([label,value,tag]) => <div className="stat-card" key={label}><span>{tag}</span><b>{value ?? '—'}</b><small>{label}</small></div>)}</div><div className="panel admin-activity"><h2>{section === 'reports' ? 'Latest recorded activity' : 'Recent activity'}</h2>{activities.length ? activities.map((a) => <div key={a.id}><span className="activity-dot" /><p><b>{a.action}</b><small>{a.detail} · {new Date(a.created_at).toLocaleString('en-IN')}</small></p></div>) : <p>No recent activity.</p>}</div></>}
      {!loading && ['cars','approvals','featured'].includes(section) && <AdminCars key={section} mode={section} cars={cars} onAction={carAction} onCreate={createCar} onDelete={(id) => setConfirm({id, type:'car'})} />}
      {!loading && ['users','sellers'].includes(section) && <div className="panel"><div className="admin-table-heading"><h2>{section === 'sellers' ? 'Marketplace sellers' : 'Registered users'}</h2><form onSubmit={(e) => {e.preventDefault();load(section,query);}} className="admin-search"><Search size={16}/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search name, email, or phone" /></form></div><div className="table-scroll"><table><thead><tr><th>Account</th><th>Contact</th><th>Listings</th><th>Joined</th><th>Status</th><th>Action</th></tr></thead><tbody>{visibleUsers.map((u)=><tr key={u.id}><td><b>{u.name}</b><small>{u.role}{u.isSeller?' · Seller':''}</small></td><td>{u.email}<small>{u.phone}</small></td><td>{u.listingCount||0}</td><td>{new Date(u.created_at).toLocaleDateString('en-IN')}</td><td><StatusBadge status={u.active?'Active':'Inactive'} /></td><td><button className="table-link" onClick={()=>openUser(u.id)}>View</button>{u.role !== 'admin' && <button className="table-link" onClick={()=>u.active?setConfirm({id:u.id,type:'user'}):userAction(u.id,true)}>{u.active?'Deactivate':'Activate'}</button>}</td></tr>)}</tbody></table>{!visibleUsers.length&&<p className="table-empty">{section==='sellers'?'No sellers match this search.':'No users found.'}</p>}</div></div>}
      {!loading && section === 'enquiries' && <div className="panel"><div className="admin-table-heading"><h2>Customer enquiries <small>Seller contact details are available to authorized administrators.</small></h2></div><div className="table-scroll"><table><thead><tr><th>Buyer</th><th>Car / message</th><th>Seller contact</th><th>Type / date</th><th>Status</th><th>Update</th></tr></thead><tbody>{enquiries.map((e)=><tr key={e.id}><td><b>{e.buyer_name}</b><small>{e.buyer_email} · {e.buyer_phone}</small></td><td>{e.brand} {e.model}<small>{e.message||'No message provided.'}</small></td><td>{e.seller_name}<small>{e.seller_phone}</small></td><td>{e.type}<small>{new Date(e.created_at).toLocaleDateString('en-IN')}</small></td><td><StatusBadge status={e.status} /></td><td><select aria-label={`Update enquiry ${e.id}`} value={e.status} onChange={(ev)=>enquiryAction(e.id,ev.target.value)}>{['Pending','Contacted','Approved','Completed','Cancelled'].map((s)=><option key={s}>{s}</option>)}</select></td></tr>)}</tbody></table>{!enquiries.length&&<p className="table-empty">No enquiries to review.</p>}</div></div>}
      {!loading && section === 'settings' && profile && <form className="panel admin-settings form-stack" onSubmit={saveProfile}><h2>Administrator profile</h2><p>Update the name and phone number attached to your authorized account.</p><label>Full name<input name="name" required maxLength="80" defaultValue={profile.name}/></label><label>Email address<input value={profile.email} disabled/></label><label>Phone number<input name="phone" required type="tel" defaultValue={profile.phone}/></label><button className="button">Save profile</button><div className="admin-security-note"><ShieldCheck size={18}/> Access is verified by the MongoDB-backed session and server-side role middleware.</div></form>}
    </section>
    {confirm && <ConfirmModal title={confirm.type==='car'?'Delete this listing?':'Deactivate this account?'} text={confirm.type==='car'?'This action permanently removes this listing, its uploaded photos, favourites, and related enquiries.':'This user will no longer be able to sign in or use their account until it is reactivated.'} onCancel={()=>setConfirm(null)} onConfirm={confirmAction} />}
    {selectedUser && <div className="modal-backdrop" role="presentation" onClick={()=>setSelectedUser(null)}><div className="confirm-modal admin-edit-modal" role="dialog" aria-modal="true" onClick={(e)=>e.stopPropagation()}><h3>{selectedUser.user.name}</h3><p>{selectedUser.user.email} · {selectedUser.user.phone}</p><StatusBadge status={selectedUser.user.active?'Active':'Inactive'} /><h4>Listings ({selectedUser.cars.length})</h4><div className="user-listing-details">{selectedUser.cars.length?selectedUser.cars.map((car)=><div key={car.id}><b>{car.year} {car.brand} {car.model}</b><small>{currency(car.price)} · {car.status}</small></div>):<p>This user has no car listings.</p>}</div><div className="edit-actions"><button className="button" onClick={()=>setSelectedUser(null)}>Close</button></div></div></div>}
  </div>;
}

function AdminCars({ mode, cars, onAction, onCreate, onDelete }) {
  const [status,setStatus] = useState(mode === 'approvals' ? 'pending' : 'all');
  const [fuel,setFuel] = useState('all'); const [query,setQuery] = useState('');
  const [minPrice,setMinPrice] = useState(''); const [maxPrice,setMaxPrice] = useState('');
  const [minYear,setMinYear] = useState(''); const [maxYear,setMaxYear] = useState('');
  const [editCar,setEditCar] = useState(null); const [viewCar,setViewCar] = useState(null);
  const [adding,setAdding] = useState(false); const [saving,setSaving] = useState(false);
  const filtered = cars.filter((c) => (mode === 'approvals' ? c.status === 'pending' : status === 'all' || c.status === status) &&
    (fuel === 'all' || c.fuel === fuel) && (mode !== 'featured' || c.featured) &&
    (!minPrice || c.price >= Number(minPrice)) && (!maxPrice || c.price <= Number(maxPrice)) &&
    (!minYear || c.year >= Number(minYear)) && (!maxYear || c.year <= Number(maxYear)) &&
    `${c.brand} ${c.model} ${c.seller_name} ${c.year}`.toLowerCase().includes(query.toLowerCase()));
  const title = mode === 'approvals' ? 'Listings awaiting approval' : mode === 'featured' ? 'Featured listings' : 'All car listings';

  async function save(event, current) {
    event.preventDefault(); setSaving(true);
    const form = event.currentTarget; const body = new FormData(form);
    body.set('featured', form.elements.featured.checked ? 'true' : 'false');
    if (current) body.set('retainedPhotos', JSON.stringify([...form.querySelectorAll('input[name="retainedPhoto"]:checked')].map((input) => input.value)));
    try {
      if (current) await onAction(current.id, body);
      else await onCreate(body);
      setEditCar(null); setAdding(false);
    } catch { /* Keep the form open after the parent reports an API error. */ }
    finally { setSaving(false); }
  }

  function editor(current) {
    return <form className="confirm-modal admin-edit-modal" onClick={(e)=>e.stopPropagation()} onSubmit={(e)=>save(e,current)}>
      <h3>{current ? 'Edit car details' : 'Add a car listing'}</h3>
      <div className="form-grid">
        <label>Brand<input name="brand" required maxLength="60" defaultValue={current?.brand}/></label>
        <label>Model<input name="model" required maxLength="80" defaultValue={current?.model}/></label>
        <label>Year<input name="year" type="number" required min="1950" max={new Date().getFullYear()+1} defaultValue={current?.year}/></label>
        <label>Price (₹)<input name="price" type="number" required min="10000" max="100000000" defaultValue={current?.price}/></label>
        <label>Kilometres<input name="mileage" type="number" required min="0" max="2000000" defaultValue={current?.mileage}/></label>
        <label>Previous owners<input name="owners" type="number" required min="1" max="10" defaultValue={current?.owners}/></label>
        <label>Fuel<select name="fuel" defaultValue={current?.fuel||'Petrol'}>{['Petrol','Diesel','CNG','Electric','Hybrid'].map((item)=><option key={item}>{item}</option>)}</select></label>
        <label>Transmission<select name="transmission" defaultValue={current?.transmission||'Manual'}><option>Manual</option><option>Automatic</option></select></label>
        <label>City<input name="location" required maxLength="80" defaultValue={current?.location}/></label>
        <label>Seller name<input name="sellerName" required maxLength="80" defaultValue={current?.seller_name||'Saran Cars'}/></label>
        <label>Seller phone<input name="sellerPhone" required maxLength="20" defaultValue={current?.seller_phone||'+910000000000'}/></label>
        <label className="span-two">Description<textarea name="description" required minLength="15" maxLength="2000" defaultValue={current?.description}/></label>
        {current?.photos?.length>0&&<div className="span-two admin-photo-list"><span>Keep selected current images</span>{current.photos.map((photo)=><label key={photo}><input name="retainedPhoto" type="checkbox" value={photo} defaultChecked/><img src={photo} alt="Current car listing" onError={handleImageError}/></label>)}</div>}
        <label className="span-two">Images {current?'(optional additions)':'(at least one required)'}<input name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple required={!current}/></label>
        <label className="admin-checkbox"><input name="featured" type="checkbox" defaultChecked={current?.featured}/> Feature this listing</label>
      </div>
      <div className="edit-actions"><button type="button" className="button button-outline" onClick={()=>{setAdding(false);setEditCar(null);}}>Cancel</button><button className="button" disabled={saving}>{saving?'Saving…':current?'Save details':'Create listing'}</button></div>
    </form>;
  }

  return <div className="panel">
    <div className="admin-table-heading"><h2>{title}</h2><div className="admin-filters">
      <input placeholder="Search brand, model, seller, year" aria-label="Search listings" value={query} onChange={(e)=>setQuery(e.target.value)}/>
      {mode!=='approvals'&&<select aria-label="Filter listing status" value={status} onChange={(e)=>setStatus(e.target.value)}><option value="all">All statuses</option>{['pending','approved','rejected','sold','unavailable'].map((item)=><option key={item} value={item}>{item}</option>)}</select>}
      <select aria-label="Filter fuel" value={fuel} onChange={(e)=>setFuel(e.target.value)}><option value="all">All fuels</option>{['Petrol','Diesel','CNG','Electric','Hybrid'].map((item)=><option key={item}>{item}</option>)}</select>
      <input aria-label="Minimum price" type="number" placeholder="Min ₹" value={minPrice} onChange={(e)=>setMinPrice(e.target.value)}/>
      <input aria-label="Maximum price" type="number" placeholder="Max ₹" value={maxPrice} onChange={(e)=>setMaxPrice(e.target.value)}/>
      <input aria-label="Minimum year" type="number" placeholder="From year" value={minYear} onChange={(e)=>setMinYear(e.target.value)}/>
      <input aria-label="Maximum year" type="number" placeholder="To year" value={maxYear} onChange={(e)=>setMaxYear(e.target.value)}/>
      {mode==='cars'&&<button className="button button-small" onClick={()=>setAdding(true)}>Add car</button>}
    </div></div>
    <div className="table-scroll"><table><thead><tr><th>Car / seller</th><th>Price / mileage</th><th>Status</th><th>Sample</th><th>Actions</th></tr></thead><tbody>{filtered.map((c)=><tr key={c.id}>
      <td><b>{c.brand} {c.model} ({c.year})</b><small>{c.seller_name} · {c.seller_phone} · {c.location}</small></td>
      <td>{currency(c.price)}<small>{Number(c.mileage).toLocaleString('en-IN')} km · {c.fuel}</small></td><td><StatusBadge status={c.status}/></td><td>{c.is_demo?'Sample':'User/admin'}</td>
      <td className="admin-actions"><button onClick={()=>setViewCar(c)}>View</button><button onClick={()=>setEditCar(c)}>Edit</button>
        {c.status==='pending'&&<><button onClick={()=>onAction(c.id,{status:'approved'})}>Approve</button><button onClick={()=>onAction(c.id,{status:'rejected'})}>Reject</button></>}
        {c.status==='approved'&&<button onClick={()=>onAction(c.id,{status:'sold'})}>Mark sold</button>}
        <button onClick={()=>onAction(c.id,{featured:!c.featured})}>{c.featured?'Unfeature':'Feature'}</button><button className="danger-text" onClick={()=>onDelete(c.id)}>Delete</button>
      </td></tr>)}</tbody></table>{!filtered.length&&<p className="table-empty">No matching listings.</p>}</div>
    {(adding||editCar)&&<div className="modal-backdrop" role="presentation" onClick={()=>{setAdding(false);setEditCar(null);}}>{editor(editCar)}</div>}
    {viewCar&&<div className="modal-backdrop" role="presentation" onClick={()=>setViewCar(null)}><div className="confirm-modal admin-edit-modal" role="dialog" aria-modal="true" onClick={(e)=>e.stopPropagation()}><h3>{viewCar.year} {viewCar.brand} {viewCar.model}</h3>{viewCar.photos?.[0]&&<img className="admin-preview-image" src={viewCar.photos[0]} alt={`${viewCar.brand} ${viewCar.model}`} onError={handleImageError}/>}<div className="spec-grid">{[['Price',currency(viewCar.price)],['Mileage',`${Number(viewCar.mileage).toLocaleString('en-IN')} km`],['Fuel',viewCar.fuel],['Transmission',viewCar.transmission],['Owners',viewCar.owners],['Location',viewCar.location],['Seller',viewCar.seller_name],['Phone',viewCar.seller_phone]].map(([label,value])=><div key={label}><small>{label}</small><b>{value}</b></div>)}</div><p>{viewCar.description}</p><div className="edit-actions"><button className="button" onClick={()=>setViewCar(null)}>Close</button></div></div></div>}
  </div>;
}

function About() {
  return <><section className="inner-hero"><div className="container"><span className="eyebrow">OUR STORY</span><h1>Making the next car feel like the right choice.</h1><p>Saran Cars is a local-first marketplace built around good information and direct connections.</p></div></section><section className="section container about-content"><div><h2>Clear choices, better journeys.</h2><p>Buying a pre-owned car is a big decision. Our goal is to make the search feel simpler: see useful details, compare cars at your pace, and talk directly with sellers.</p><p>We provide a place to discover listings—not a guarantee of vehicle condition or availability. Buyers should inspect a car and independently verify its history, ownership, and documents before making a purchase.</p></div><div className="about-callout"><ShieldCheck size={28}/><h3>Confidence begins with clarity.</h3><p>Every listing describes its status clearly, and sample records are marked so nobody confuses examples with a confirmed offer.</p></div></section></>;
}
function Contact() {
  const [submitted,setSubmitted] = useState(false); const [error,setError] = useState(''); const [busy,setBusy] = useState(false);
  async function submit(e) { e.preventDefault(); setSubmitted(false); setError(''); setBusy(true); const formElement=e.currentTarget; const form = new FormData(formElement); try { await api('/contact',json('POST',Object.fromEntries(form))); setSubmitted(true); formElement.reset(); } catch (err) { setError(err.message); } finally { setBusy(false); } }
  return <div className="container page-wrap contact-layout"><div><span className="eyebrow">WE'RE HERE TO HELP</span><h1>Let's talk cars.</h1><p>Questions about using the marketplace? Send us a note and our team will be in touch.</p><div className="contact-info"><a href="mailto:hello@sarancars.example">hello@sarancars.example</a><a href="tel:+914440001234">+91 44 4000 1234</a><span>Chennai, Tamil Nadu, India</span></div><div className="demo-notice"><ShieldCheck size={18}/><span>Contact details shown are placeholders for this project. Messages submitted here are saved to the local application database; no email is sent.</span></div></div><form className="panel form-stack" onSubmit={submit}>{submitted&&<div className="success-banner" role="status">Your message was received and saved. The Saran Cars team will follow up.</div>}{error&&<div className="form-error" role="alert">{error}</div>}<label>Your name<input name="name" required maxLength="80" /></label><label>Email address<input name="email" required type="email" /></label><label>How can we help?<textarea name="message" required maxLength="2000" rows="5" /></label><button className="button" disabled={busy}>{busy?'Sending…':'Send a message'} <ArrowRight size={17}/></button></form></div>;
}
function NotFound() { return <div className="container page-wrap"><div className="empty-state"><span className="eyebrow">404 · WRONG TURN?</span><h1>That page isn't here.</h1><p>Let's get you back on the road.</p><Link className="button" to="/">Go to homepage <ArrowRight size={17}/></Link></div></div>; }

export default App;
