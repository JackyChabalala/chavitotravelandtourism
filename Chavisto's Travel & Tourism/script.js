/* ── MODAL ── */
const menu   = document.getElementById("menu");
const links  = document.getElementById("links");
const modal  = document.getElementById("modal");
const closeBtn = document.getElementById("close");
const bookingForm = document.getElementById("bookingForm");
const formMessage = document.getElementById("formMessage");

document.querySelectorAll(".book-trigger").forEach(btn =>
  btn.addEventListener("click", e => {
    e.preventDefault();
    modal.classList.add("show");
  })
);
menu.addEventListener("click", () => {
  const isOpen = links.classList.toggle("show");
  menu.classList.toggle("open", isOpen);
  menu.setAttribute("aria-expanded", String(isOpen));
});
links.querySelectorAll("a").forEach(a => {
  a.addEventListener("click", () => {
    links.classList.remove("show");
    menu.classList.remove("open");
    menu.setAttribute("aria-expanded", "false");
  });
});
closeBtn.addEventListener("click", () => modal.classList.remove("show"));
modal.addEventListener("click", e => { if (e.target === modal) modal.classList.remove("show"); });
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    links.classList.remove("show");
    menu.classList.remove("open");
    menu.setAttribute("aria-expanded", "false");
    modal.classList.remove("show");
  }
});

const td = document.getElementById("travelDate");
if (td) td.min = new Date().toISOString().split("T")[0];
const yr = document.getElementById("year");
if (yr) yr.textContent = new Date().getFullYear();

const phonePattern = /^[+0-9()\-\s]{8,20}$/;

const locationSuggestionsList = document.getElementById("locationSuggestions");
const pickupInput = bookingForm ? bookingForm.elements.pickup : null;
const dropoffInput = bookingForm ? bookingForm.elements.dropoff : null;
const localFallbackLocations = [];
let locationFetchTimer = null;
let activeLocationAbortController = null;
const locationCache = new Map();

function renderLocationSuggestions(items = []) {
  if (!locationSuggestionsList) return;
  const finalList = [...new Set(items)].slice(0, 12);
  locationSuggestionsList.innerHTML = finalList
    .map(item => `<option value="${item.replace(/"/g, "&quot;")}"></option>`)
    .join("");
}

function getFallbackSuggestions(query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return localFallbackLocations.slice(0, 8);
  return localFallbackLocations.filter(item => item.toLowerCase().includes(q)).slice(0, 8);
}

async function fetchLocationSuggestions(query) {
  const q = String(query || "").trim();
  if (q.length < 2) {
    renderLocationSuggestions(getFallbackSuggestions(q));
    return;
  }

  const cacheKey = q.toLowerCase();
  if (locationCache.has(cacheKey)) {
    renderLocationSuggestions(locationCache.get(cacheKey));
    return;
  }

  if (activeLocationAbortController) activeLocationAbortController.abort();
  activeLocationAbortController = new AbortController();

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=10&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      signal: activeLocationAbortController.signal,
      headers: { Accept: "application/json" }
    });
    if (!res.ok) throw new Error("Location lookup failed");

    const data = await res.json();
    const suggestions = (Array.isArray(data) ? data : [])
      .map(item => item.display_name)
      .filter(Boolean);

    const combined = [...suggestions, ...getFallbackSuggestions(q)];
    locationCache.set(cacheKey, combined);
    renderLocationSuggestions(combined);
  } catch (err) {
    if (err && err.name === "AbortError") return;
    renderLocationSuggestions(getFallbackSuggestions(q));
  }
}

if (pickupInput && dropoffInput && locationSuggestionsList) {
  renderLocationSuggestions(localFallbackLocations);
  [pickupInput, dropoffInput].forEach(input => {
    input.addEventListener("input", () => {
      const value = input.value;
      clearTimeout(locationFetchTimer);
      locationFetchTimer = setTimeout(() => fetchLocationSuggestions(value), 220);
    });
    input.addEventListener("focus", () => fetchLocationSuggestions(input.value));
  });

  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`)
          .then(res => (res.ok ? res.json() : null))
          .then(data => {
            if (!data || !data.display_name) return;
            const currentArea = data.display_name.split(",").slice(0, 4).join(",").trim();
            if (!currentArea) return;
            localFallbackLocations.unshift(currentArea);
            renderLocationSuggestions(getFallbackSuggestions(""));
          })
          .catch(() => {});
      },
      () => {},
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 600000 }
    );
  }
}

function setFormMessage(type, text) {
  if (!formMessage) return;
  formMessage.className = `form-message show ${type}`;
  formMessage.textContent = text;
}

function clearFieldErrors() {
  bookingForm.querySelectorAll(".form-error").forEach(el => el.classList.remove("form-error"));
}

function markFieldError(field, message) {
  field.classList.add("form-error");
  field.focus();
  setFormMessage("error", message);
}

bookingForm.addEventListener("submit", e => {
  e.preventDefault();
  clearFieldErrors();
  if (formMessage) {
    formMessage.className = "form-message";
    formMessage.textContent = "";
  }

  const d = Object.fromEntries(new FormData(bookingForm).entries());
  const requiredFields = [
    ["name", "Please enter your full name."],
    ["phone", "Please enter a valid phone number so we can confirm your booking."],
    ["email", "Please enter your email address."],
    ["service", "Please choose a service type."],
    ["pickup", "Please enter your pickup location."],
    ["dropoff", "Please enter your drop-off location."],
    ["date", "Please select your travel date."],
    ["time", "Please select your pickup time."],
    ["passengers", "Please choose number of passengers."]
  ];

  for (const [name, message] of requiredFields) {
    const field = bookingForm.elements[name];
    if (!field || !String(field.value || "").trim()) {
      markFieldError(field, message);
      return;
    }
  }

  const emailField = bookingForm.elements.email;
  if (!emailField.checkValidity()) {
    markFieldError(emailField, "Please enter a valid email address.");
    return;
  }

  const phoneField = bookingForm.elements.phone;
  if (!phonePattern.test(String(phoneField.value).trim())) {
    markFieldError(phoneField, "Please enter a valid phone number (only digits, +, spaces, brackets, or dashes).");
    return;
  }

  const msg = `Hello Chavisto's Travel & Tourism!\n\nI would like to book premium transport:\nName: ${d.name}\nPhone: ${d.phone}\nEmail: ${d.email}\nService: ${d.service}\nPickup: ${d.pickup}\nDrop-off: ${d.dropoff}\nDate: ${d.date}\nTime: ${d.time}\nPassengers: ${d.passengers}\nNotes: ${d.notes || "None"}\n\nPlease confirm availability and final quote.`;
  const whatsappUrl = `https://wa.me/27734428951?text=${encodeURIComponent(msg)}`;
  const popup = window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  if (!popup) {
    navigator.clipboard.writeText(msg).catch(() => {});
    setFormMessage("error", "Popup blocked. We copied your message. Please open WhatsApp manually and paste it.");
    window.location.href = whatsappUrl;
    return;
  }
  setFormMessage("success", "Opening WhatsApp with your booking details...");
  bookingForm.reset();
  modal.classList.remove("show");
});

/* ── REVEAL ── */
const reveals = document.querySelectorAll(".reveal");
const rObs = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("show"); rObs.unobserve(e.target); }});
}, { threshold: 0.12 });
reveals.forEach(el => rObs.observe(el));

/* ── COUNTERS ── */
const counters = document.querySelectorAll(".counter");
const cObs = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const el = entry.target;
    const target = parseInt(el.dataset.target);
    const dur = 1600; const step = target / (dur / 16);
    let val = 0;
    const t = setInterval(() => {
      val = Math.min(val + step, target);
      el.textContent = Math.floor(val) + "+";
      if (val >= target) clearInterval(t);
    }, 16);
    cObs.unobserve(el);
  });
}, { threshold: 0.3 });
counters.forEach(c => cObs.observe(c));

/* ── 3D CARD TILT ── */
const card = document.getElementById("bankCard");
if (card) {
  let animFrame;
  card.addEventListener("mousemove", e => {
    cancelAnimationFrame(animFrame);
    animFrame = requestAnimationFrame(() => {
      const r = card.getBoundingClientRect();
      const dx = (e.clientX - r.left - r.width/2) / (r.width/2);
      const dy = (e.clientY - r.top - r.height/2) / (r.height/2);
      card.style.transition = "transform .05s ease";
      card.style.transform = `translateY(-12px) rotateX(${-dy*9}deg) rotateY(${dx*9}deg) scale(1.02)`;
    });
  });
  card.addEventListener("mouseleave", () => {
    cancelAnimationFrame(animFrame);
    card.style.transition = "transform .6s cubic-bezier(.23,1,.32,1)";
    card.style.transform = "";
  });
}

/* ── ACTIVE NAV ── */
const secs = document.querySelectorAll("section[id]");
const navAs = document.querySelectorAll(".links a");
const nObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      navAs.forEach(a => a.classList.remove("active"));
      const m = document.querySelector(`.links a[href="#${e.target.id}"]`);
      if (m) m.classList.add("active");
    }
  });
}, { threshold: 0.4 });
secs.forEach(s => nObs.observe(s));

/* ══════════════════════════════════
   PREMIUM INTERACTIVITY
══════════════════════════════════ */
const prefersReduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Scroll progress bar + nav scrolled state + back-to-top */
const progressBar = document.getElementById("progressBar");
const toTop = document.getElementById("toTop");
const navEl = document.querySelector(".nav");
function onScroll() {
  const h = document.documentElement;
  const max = (h.scrollHeight - h.clientHeight) || 1;
  const pct = Math.min(100, Math.max(0, (h.scrollTop / max) * 100));
  if (progressBar) progressBar.style.width = pct + "%";
  if (navEl) navEl.classList.toggle("scrolled", h.scrollTop > 40);
  if (toTop) toTop.classList.toggle("show", h.scrollTop > 500);
}
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

if (toTop) {
  toTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
}

/* Cursor glow (desktop, fine pointer only) */
const cursorGlow = document.getElementById("cursorGlow");
const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
if (cursorGlow && canHover && !prefersReduce) {
  let tx = 0, ty = 0, cx = 0, cy = 0;
  let visible = false;
  window.addEventListener("mousemove", e => {
    tx = e.clientX; ty = e.clientY;
    if (!visible) { cursorGlow.classList.add("active"); visible = true; }
  });
  window.addEventListener("mouseout", e => {
    if (!e.relatedTarget) { cursorGlow.classList.remove("active"); visible = false; }
  });
  (function tick(){
    cx += (tx - cx) * 0.12;
    cy += (ty - cy) * 0.12;
    cursorGlow.style.transform = `translate(${cx}px, ${cy}px) translate(-50%,-50%)`;
    requestAnimationFrame(tick);
  })();
}

/* Magnetic buttons + radial hover highlight */
if (!prefersReduce && canHover) {
  document.querySelectorAll(".btn, .nav-btn, .tiny-btn").forEach(btn => {
    btn.addEventListener("mousemove", e => {
      const r = btn.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      btn.style.setProperty("--mx", `${(mx / r.width) * 100}%`);
      btn.style.setProperty("--my", `${(my / r.height) * 100}%`);
      const dx = (mx - r.width / 2) / r.width;
      const dy = (my - r.height / 2) / r.height;
      btn.style.transform = `translate(${dx * 6}px, ${dy * 6}px)`;
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.transform = "";
    });
  });
}

/* Hero parallax */
const heroCard = document.getElementById("heroCard");
if (heroCard && canHover && !prefersReduce) {
  let raf;
  heroCard.addEventListener("mousemove", e => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const r = heroCard.getBoundingClientRect();
      const dx = (e.clientX - r.left - r.width / 2) / r.width;
      const dy = (e.clientY - r.top - r.height / 2) / r.height;
      heroCard.style.backgroundPosition = `${50 + dx * 6}% ${50 + dy * 6}%`;
      const left = heroCard.querySelector(".hero-left");
      if (left) left.style.transform = `translate(${dx * -6}px, ${dy * -4}px)`;
    });
  });
  heroCard.addEventListener("mouseleave", () => {
    heroCard.style.backgroundPosition = "";
    const left = heroCard.querySelector(".hero-left");
    if (left) left.style.transform = "";
  });
}

/* Stagger-in for card grids on scroll */
const cardTargets = document.querySelectorAll(".dest, .pkg, .p-card, .stat, .testi, .faq-item");
cardTargets.forEach((t, i) => {
  t.classList.add("reveal-soft");
  t.style.transitionDelay = `${Math.min(i, 6) * 70}ms`;
});
const sObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add("in"); sObs.unobserve(e.target); }
  });
}, { threshold: 0.12 });
cardTargets.forEach(t => sObs.observe(t));

/* Destination pager — horizontally scroll grid */
document.querySelectorAll(".section").forEach(sec => {
  const pagerBtns = sec.querySelectorAll(".pager button");
  const grid = sec.querySelector(".dest-grid, .pkg-grid");
  if (pagerBtns.length !== 2 || !grid) return;
  const step = () => grid.getBoundingClientRect().width / 2 + 20;
  pagerBtns[0].addEventListener("click", () => {
    const first = grid.firstElementChild;
    if (first) first.animate(
      [{ transform: "translateX(-10px)" }, { transform: "translateX(0)" }],
      { duration: 400, easing: "cubic-bezier(.34,1.56,.64,1)" }
    );
    grid.scrollBy({ left: -step(), behavior: "smooth" });
  });
  pagerBtns[1].addEventListener("click", () => {
    const last = grid.lastElementChild;
    if (last) last.animate(
      [{ transform: "translateX(10px)" }, { transform: "translateX(0)" }],
      { duration: 400, easing: "cubic-bezier(.34,1.56,.64,1)" }
    );
    grid.scrollBy({ left: step(), behavior: "smooth" });
  });
});

/* Form micro: floating focus */
document.querySelectorAll(".form input, .form select, .form textarea").forEach(input => {
  input.addEventListener("focus", () => input.parentElement && input.parentElement.classList && input.parentElement.classList.add("is-focused"));
  input.addEventListener("blur", () => input.parentElement && input.parentElement.classList && input.parentElement.classList.remove("is-focused"));
});
