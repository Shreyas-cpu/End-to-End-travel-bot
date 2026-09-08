// SkyVoyage AI Client Application
let currentSessionId = localStorage.getItem('skyvoyage_session_id') || null;

const messagesContainer = document.getElementById('messagesContainer');
const chatForm = document.getElementById('chatForm');
const messageInput = document.getElementById('messageInput');
const typingIndicator = document.getElementById('typingIndicator');
const btnResetSession = document.getElementById('btnResetSession');
const sidebarToggle = document.getElementById('sidebarToggle');
const sidebar = document.getElementById('sidebar');

// Sidebar Steps Elements
const stepElements = {
  INITIATION: document.getElementById('step-initiation'),
  FLIGHT_SELECTION: document.getElementById('step-flight'),
  HOTEL_SELECTION: document.getElementById('step-hotel'),
  CAB_SELECTION: document.getElementById('step-cab'),
  CHECKOUT_SUMMARY: document.getElementById('step-summary'),
  CONFIRMED: document.getElementById('step-confirmed')
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  registerServiceWorker();
  updateProviderHealthBadges();
  if (currentSessionId) {
    loadChatHistory(currentSessionId);
  }
});

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.log('SW registration note:', err);
      });
    });
  }
}

function setupEventListeners() {
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (!text) return;
    sendMessage(text);
    messageInput.value = '';
    messageInput.blur(); // Dismiss Android virtual keyboard after sending
  });

  // Quick Chips
  document.addEventListener('click', (e) => {
    const chip = e.target.closest('.quick-chip');
    if (chip) {
      const prompt = chip.getAttribute('data-prompt');
      if (prompt) {
        sendMessage(prompt);
      }
    }
  });

  // Reset Session
  btnResetSession.addEventListener('click', async () => {
    if (confirm('Start a fresh travel booking session?')) {
      localStorage.removeItem('skyvoyage_session_id');
      currentSessionId = null;
      window.location.reload();
    }
  });

  // Mobile Sidebar Toggle & Backdrop
  let backdrop = document.querySelector('.sidebar-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'sidebar-backdrop';
    document.body.appendChild(backdrop);
  }

  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      backdrop.classList.toggle('active', sidebar.classList.contains('open'));
    });
  }

  backdrop.addEventListener('click', () => {
    sidebar.classList.remove('open');
    backdrop.classList.remove('active');
  });

  // Initialize Theme (Light / Dark)
  initTheme();
}

function initTheme() {
  const savedTheme = localStorage.getItem('skyvoyage_theme') || 'light';
  setTheme(savedTheme);

  const btnLight = document.getElementById('btnThemeLight');
  const btnDark = document.getElementById('btnThemeDark');

  if (btnLight) {
    btnLight.addEventListener('click', () => setTheme('light'));
  }
  if (btnDark) {
    btnDark.addEventListener('click', () => setTheme('dark'));
  }
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('skyvoyage_theme', theme);

  const btnLight = document.getElementById('btnThemeLight');
  const btnDark = document.getElementById('btnThemeDark');
  if (btnLight) btnLight.classList.toggle('active', theme === 'light');
  if (btnDark) btnDark.classList.toggle('active', theme === 'dark');

  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', theme === 'light' ? '#003580' : '#001e33');
  }
}

async function sendMessage(text, actionPayload = null) {
  // Render user message in chat
  if (text) {
    appendUserMessage(text);
  }

  showTyping(true);

  try {
    const response = await fetch('/api/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: currentSessionId,
        message: text,
        actionPayload
      })
    });

    const data = await response.json();
    showTyping(false);

    if (data.sessionId) {
      currentSessionId = data.sessionId;
      localStorage.setItem('skyvoyage_session_id', currentSessionId);
    }

    // Update Sidebar Workflow Indicator
    updateWorkflowTracker(data.step);

    // Refresh provider health badges
    updateProviderHealthBadges();

    // Append Assistant Response
    appendAssistantMessage(data.reply, data.cards);

  } catch (error) {
    showTyping(false);
    console.error('Error sending message:', error);
    appendAssistantMessage('⚠️ Connection error. Please make sure the backend server is running and try again.');
  }
}

async function loadChatHistory(sessionId) {
  try {
    const response = await fetch(`/api/chat/history/${sessionId}`);
    if (!response.ok) return;

    const data = await response.json();
    if (data.messages && data.messages.length > 0) {
      messagesContainer.innerHTML = '';
      data.messages.forEach(msg => {
        if (msg.role === 'user') {
          appendUserMessage(msg.content);
        } else {
          appendAssistantMessage(msg.content, msg.metadata);
        }
      });
      if (data.session?.currentStep) {
        updateWorkflowTracker(data.session.currentStep);
      }
    }
  } catch (err) {
    console.warn('Could not load history:', err);
  }
}

async function updateProviderHealthBadges() {
  try {
    const response = await fetch('/api/health');
    if (!response.ok) return;
    const data = await response.json();
    if (!data.providers) return;

    const bkgBadge = document.getElementById('bkg-badge');
    const fltBadge = document.getElementById('flt-badge');
    const payBadge = document.getElementById('pay-badge');
    const llmBadge = document.getElementById('llm-badge');

    const updateSingleBadge = (el, info) => {
      if (!el || !info) return;
      if (info.mode === 'mock') {
        el.textContent = 'Mock Mode';
        el.className = 'pill-badge mock';
      } else if (info.configured) {
        el.textContent = 'Live API';
        el.className = 'pill-badge live';
      } else {
        el.textContent = 'No API Key';
        el.className = 'pill-badge error';
      }
      el.title = info.status || '';
    };

    updateSingleBadge(bkgBadge, data.providers.hotels);
    updateSingleBadge(fltBadge, data.providers.flights);
    updateSingleBadge(payBadge, data.providers.payments);

    if (llmBadge && data.providers.llm) {
      const ok = data.providers.llm.configured;
      const isRule = data.providers.llm.provider === 'rule_engine';
      llmBadge.textContent = isRule ? 'Rule Engine' : (ok ? 'Gemini 2.5' : 'No API Key');
      llmBadge.className = `pill-badge ${isRule ? 'mock' : (ok ? 'live' : 'error')}`;
      llmBadge.title = data.providers.llm.status || '';
    }
  } catch (err) {
    console.warn('Failed to fetch provider health:', err);
  }
}

function appendUserMessage(text) {
  const row = document.createElement('div');
  row.className = 'message-row user';
  row.innerHTML = `
    <div class="avatar"><i class="fa-solid fa-user"></i></div>
    <div class="message-content">
      <div class="message-bubble">
        <p>${escapeHtml(text)}</p>
      </div>
    </div>
  `;
  messagesContainer.appendChild(row);
  scrollToBottom();
}

function appendAssistantMessage(text, cards) {
  const row = document.createElement('div');
  row.className = 'message-row assistant';

  const formattedText = formatMarkdown(text);

  let cardsHtml = '';
  if (cards) {
    cardsHtml = renderCards(cards);
  }

  row.innerHTML = `
    <div class="avatar"><i class="fa-solid fa-compass"></i></div>
    <div class="message-content">
      <div class="message-bubble">
        ${formattedText}
      </div>
      ${cardsHtml}
    </div>
  `;

  messagesContainer.appendChild(row);
  attachCardActionHandlers(row);
  scrollToBottom();
}

function renderCards(cards) {
  if (!cards || !cards.type) return '';

  if (cards.type === 'flights' && Array.isArray(cards.data)) {
    window.cachedFlights = cards.data;
    const cabinList = ['Economy', 'Premium Economy', 'Business', 'First Class'];
    const periodBadges = {
      morning: '🌅 Morning',
      afternoon: '🌤️ Afternoon',
      evening: '🌆 Evening',
      night: '🌙 Night'
    };

    return `
      <div class="cards-grid">
        ${cards.data.map((flight, idx) => {
          const currentCabin = flight.selectedCabin || flight.cabinClass || 'Economy';
          const currentPrice = (flight.cabinTiers && flight.cabinTiers[currentCabin]) ? flight.cabinTiers[currentCabin] : flight.price;
          const periodText = flight.departurePeriod ? (periodBadges[flight.departurePeriod] || flight.departurePeriod) : '';

          return `
          <div class="flight-card" data-flight-id="${flight.id}">
            <div class="flight-card-header">
              <div class="airline-badge">
                <div class="airline-icon"><i class="fa-solid fa-plane"></i></div>
                <span>${escapeHtml(flight.airline)}</span>
              </div>
              <div class="flight-header-meta">
                <span class="flight-num-pill">${escapeHtml(flight.flightNumber)}</span>
                ${periodText ? `<span class="period-pill">${periodText}</span>` : ''}
              </div>
            </div>

            <div class="flight-route-row">
              <div class="route-node">
                <span class="route-time">${flight.departureTime}</span>
                <span class="route-airport">${flight.originAirport}</span>
              </div>
              <div class="route-path">
                <span class="path-duration">${flight.duration}</span>
                <div class="path-line"></div>
                <span class="path-duration">${flight.stops === 0 ? 'Direct' : flight.stops + ' Stop'}</span>
              </div>
              <div class="route-node right">
                <span class="route-time">${flight.arrivalTime}</span>
                <span class="route-airport">${flight.destinationAirport}</span>
              </div>
            </div>

            <!-- Cabin Class Selector Tabs -->
            <div class="cabin-tier-selector">
              <div class="cabin-selector-label">Select Cabin Class:</div>
              <div class="cabin-pills-row">
                ${cabinList.map(cabin => {
                  const tierFare = flight.cabinTiers ? flight.cabinTiers[cabin] : null;
                  const isActive = cabin === currentCabin;
                  return `
                    <button 
                      type="button"
                      class="cabin-tier-pill ${isActive ? 'active' : ''}" 
                      data-cabin="${cabin}" 
                      onclick="handleCabinClassChange(${idx}, '${cabin}')"
                      title="${cabin}${tierFare ? ` ($${tierFare} USD)` : ''}"
                    >
                      <span>${cabin === 'Premium Economy' ? 'Premium' : cabin === 'First Class' ? 'First' : cabin}</span>
                      ${tierFare ? `<span class="tier-fare-sub">$${tierFare}</span>` : ''}
                    </button>
                  `;
                }).join('')}
              </div>
            </div>

            <div class="flight-card-footer">
              <div class="card-price" id="price-flight-${idx}">$${currentPrice} <span>USD / person</span></div>
              <button class="btn-card-select" onclick="handleSelectFlight(${idx})">
                Select <i class="fa-solid fa-arrow-right"></i>
              </button>
            </div>
          </div>
        `}).join('')}
      </div>
    `;
  }

  if (cards.type === 'hotels' && Array.isArray(cards.data)) {
    window.cachedHotels = cards.data;
    if (!window.hotelFilters) {
      window.hotelFilters = { sort: 'asc', area: 'all', maxPrice: 400, limit: 6 };
    }
    return `
      <div class="hotel-module-wrapper" id="hotelModuleWrapper">
        ${renderHotelModuleContent(cards.data)}
      </div>
    `;
  }

  if (cards.type === 'cabs' && Array.isArray(cards.data)) {
    window.cachedCabs = cards.data;
    const currentRoute = cards.routeType || window.currentCabRoute || 'airport_to_hotel';
    window.currentCabRoute = currentRoute;

    const sampleCab = cards.data[0];
    const pickupDisplay = sampleCab ? sampleCab.pickupLocation : 'Airport';
    const dropoffDisplay = sampleCab ? sampleCab.dropoffLocation : 'Hotel';

    return `
      <div class="cab-route-toolbar">
        <div class="cab-route-header-row">
          <span class="cab-route-title"><i class="fa-solid fa-route"></i> Select Transfer Direction:</span>
        </div>
        <div class="cab-route-buttons">
          <button 
            type="button" 
            class="btn-cab-route ${currentRoute === 'airport_to_hotel' ? 'active' : ''}" 
            onclick="handleSwitchCabRoute('airport_to_hotel')"
          >
            🛬 Airport ➔ Hotel
          </button>
          <button 
            type="button" 
            class="btn-cab-route ${currentRoute === 'hotel_to_airport' ? 'active' : ''}" 
            onclick="handleSwitchCabRoute('hotel_to_airport')"
          >
            🛫 Hotel ➔ Airport
          </button>
          <button 
            type="button" 
            class="btn-cab-route ${currentRoute === 'custom' ? 'active' : ''}" 
            onclick="handleSwitchCabRoute('custom')"
          >
            📍 City / Custom
          </button>
        </div>

        <div class="cab-route-active-details">
          <div class="cab-route-node pickup">
            <i class="fa-solid fa-circle-dot"></i> <strong>Pickup:</strong> <span>${escapeHtml(pickupDisplay)}</span>
          </div>
          <div class="cab-route-node dropoff">
            <i class="fa-solid fa-location-pin"></i> <strong>Drop-off:</strong> <span>${escapeHtml(dropoffDisplay)}</span>
          </div>
        </div>
      </div>

      <div class="cards-grid">
        ${cards.data.map((cab, idx) => `
          <div class="cab-card" data-cab-id="${cab.id}">
            <div class="cab-header">
              <div class="cab-icon-badge">
                <div class="cab-icon">
                  <i class="${cab.vehicleType.includes('Van') ? 'fa-solid fa-van-shuttle' : cab.vehicleType.includes('Electric') ? 'fa-solid fa-bolt' : cab.vehicleType.includes('Executive') ? 'fa-solid fa-car' : 'fa-solid fa-car-side'}"></i>
                </div>
                <div class="cab-details">
                  <h4>${escapeHtml(cab.vehicleType)}</h4>
                  <p>${escapeHtml(cab.vehicleModel)}</p>
                </div>
              </div>
              <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                <span class="pill-badge live">★ ${cab.driverRating}</span>
                ${cab.badge ? `<span class="cab-badge-pill">${escapeHtml(cab.badge)}</span>` : ''}
              </div>
            </div>

            <div class="cab-meta-row">
              <span class="cab-meta-item"><i class="fa-solid fa-user-group"></i> Up to ${cab.capacity} seats</span>
              <span class="cab-meta-item"><i class="fa-solid fa-suitcase"></i> ${cab.luggageCount} Bags</span>
              <span class="cab-meta-item"><i class="fa-solid fa-clock"></i> ${cab.estimatedDuration}</span>
            </div>

            <div class="cab-footer">
              <div class="card-price">$${cab.price} <span>fixed rate</span></div>
              <button type="button" class="btn-card-select" onclick="handleSelectCab(${idx})">
                Book Transfer <i class="fa-solid fa-check"></i>
              </button>
            </div>
          </div>
        `).join('')}
      </div>
      <div style="margin-top: 12px; text-align: right;">
        <button type="button" class="quick-chip" onclick="handleSkipCab()">Skip Transfer Service ➔</button>
      </div>
    `;
  }

  if (cards.type === 'summary' && cards.data) {
    const s = cards.data;
    window.cachedSummary = s;
    const gatewayEnv = s.paymentSession ? s.paymentSession.environment.toUpperCase() : 'SANDBOX';
    const gatewayProvider = s.paymentSession ? s.paymentSession.provider : 'Booking.com Payments API';

    return `
      <div class="summary-card">
        <div class="summary-header">
          <h3><i class="fa-solid fa-suitcase-rolling"></i> Complete Trip Summary</h3>
          <span class="pill-badge live">Verified Rates</span>
        </div>

        <div class="summary-items">
          ${s.flight ? `
            <div class="summary-item">
              <span>✈️ Flight: <strong>${escapeHtml(s.flight.airline)} (${s.flight.flightNumber})</strong></span>
              <strong>$${s.flight.price.toFixed(2)}</strong>
            </div>
          ` : ''}

          ${s.hotel ? `
            <div class="summary-item">
              <span>🏨 Hotel: <strong>${escapeHtml(s.hotel.name)} (${s.hotel.totalNights} Nights)</strong></span>
              <strong>$${s.hotel.totalPrice.toFixed(2)}</strong>
            </div>
          ` : ''}

          ${s.cab ? `
            <div class="summary-item">
              <span>🚕 Transfer: <strong>${escapeHtml(s.cab.vehicleType)}</strong></span>
              <strong>$${s.cab.price.toFixed(2)}</strong>
            </div>
          ` : ''}

          <div class="summary-divider"></div>

          <div class="summary-item">
            <span>Subtotal:</span>
            <span>$${s.subtotal.toFixed(2)}</span>
          </div>

          <div class="summary-item">
            <span>Taxes & Service Fees (12%):</span>
            <span>$${s.taxesAndFees.toFixed(2)}</span>
          </div>

          <div class="summary-divider"></div>

          <div class="summary-total">
            <span>Total Package:</span>
            <span>$${s.totalCost.toFixed(2)} USD</span>
          </div>

          <!-- Payment Security Badge or Missing Key Alert -->
          ${s.hasPaymentsKey ? `
            <div class="payment-gateway-badge">
              <i class="fa-solid fa-shield-halved"></i>
              <span>Secured by <strong>${escapeHtml(gatewayProvider)}</strong> (${gatewayEnv})</span>
            </div>
          ` : `
            <div class="payment-gateway-badge error" style="background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.3); color: #FCA5A5;">
              <i class="fa-solid fa-triangle-exclamation" style="color: #F87171;"></i>
              <span><strong>No Booking.com Payments API Key inserted!</strong> <a href="/admin.html" style="color: #60A5FA; text-decoration: underline; margin-left: 6px;">Configure in Admin</a></span>
            </div>
          `}
        </div>

        <button class="btn-confirm-booking" onclick="handleOpenPaymentModal()">
          <i class="fa-solid fa-credit-card"></i> Proceed to Payment & Confirmation
        </button>
      </div>
    `;
  }

  if (cards.type === 'ticket' && cards.data) {
    const t = cards.data;
    try {
      localStorage.setItem(`booking_${t.bookingReference}`, JSON.stringify(t));
      localStorage.setItem('last_booking', JSON.stringify(t));
    } catch (e) {}

    const printTicketUrl = `/print-ticket.html?ref=${encodeURIComponent(t.bookingReference)}`;

    return `
      <div class="ticket-card">
        <div class="ticket-header">
          <div>
            <h3 style="font-size: 16px; font-weight: 700; color: #34D399;"><i class="fa-solid fa-circle-check"></i> E-Ticket & Vouchers Issued</h3>
            <p style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Issued for ${escapeHtml(t.passengerName)} • Ref: ${escapeHtml(t.bookingReference)}</p>
          </div>
          <div class="ticket-ref-badge">${escapeHtml(t.bookingReference)}</div>
        </div>

        <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.5;">
          Your reservation is confirmed and paid via <strong>Booking.com Payments</strong>. You can print your travel vouchers directly or download the official PDF e-ticket.
        </p>

        <div class="ticket-actions">
          <a href="${t.pdfUrl}" target="_blank" class="btn-download-ticket">
            <i class="fa-solid fa-file-arrow-down"></i> Download Official PDF
          </a>
          <a href="${printTicketUrl}" target="_blank" class="btn-print-ticket">
            <i class="fa-solid fa-print"></i> Print Itinerary
          </a>
        </div>
      </div>
    `;
  }

  if (cards.type === 'error' && cards.data) {
    const e = cards.data;
    return `
      <div class="error-card">
        <div class="error-card-header">
          <div class="error-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
          <div>
            <h4>${escapeHtml(e.title || 'API Key Missing')}</h4>
            <p class="error-provider">${escapeHtml(e.provider || 'Provider Configuration')}</p>
          </div>
        </div>
        <div class="error-card-body">
          <p>${escapeHtml(e.message || 'No API Key inserted. The mock framework has been removed.')}</p>
          ${e.missingKey ? `<div class="missing-key-badge"><i class="fa-solid fa-key"></i> Missing Key: <code>${escapeHtml(e.missingKey)}</code></div>` : ''}
        </div>
        <div class="error-card-footer">
          <a href="${e.actionUrl || '/admin.html'}" class="btn-error-admin">
            <i class="fa-solid fa-sliders"></i> ${escapeHtml(e.actionLabel || 'Configure Key in Admin Dashboard')}
          </a>
        </div>
      </div>
    `;
  }

  return '';
}

function attachCardActionHandlers(container) {
  // Store cards in window context for click triggers
}

// Action Trigger Handlers
window.handleCabinClassChange = function(flightIdx, cabinName) {
  const flight = window.cachedFlights ? window.cachedFlights[flightIdx] : null;
  if (!flight || !flight.cabinTiers) return;

  flight.selectedCabin = cabinName;
  const newPrice = flight.cabinTiers[cabinName] || flight.price;
  flight.price = newPrice;

  // Update card UI
  const card = document.querySelector(`.flight-card[data-flight-id="${flight.id}"]`);
  if (!card) return;

  // Update active pill state
  card.querySelectorAll('.cabin-tier-pill').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-cabin') === cabinName);
  });

  // Update displayed price
  const priceEl = card.querySelector('.card-price');
  if (priceEl) {
    priceEl.innerHTML = `$${newPrice} <span>USD / person (${cabinName})</span>`;
  }
};

window.handleSelectFlight = function(idx) {
  const flight = window.cachedFlights ? window.cachedFlights[idx] : null;
  if (!flight) return;
  const chosenCabin = flight.selectedCabin || flight.cabinClass || 'Economy';
  const chosenPrice = (flight.cabinTiers && flight.cabinTiers[chosenCabin]) ? flight.cabinTiers[chosenCabin] : flight.price;
  const updatedFlight = { ...flight, cabinClass: chosenCabin, price: chosenPrice };

  sendMessage(`Selected Flight: ${flight.airline} (${flight.flightNumber}) — ${chosenCabin} ($${chosenPrice} USD)`, {
    action: 'SELECT_FLIGHT',
    item: updatedFlight,
    cabinClass: chosenCabin,
    price: chosenPrice
  });
};

// Hotel Module Rendering & Interactive Filter Handlers
function renderHotelModuleContent(hotels) {
  if (!window.hotelFilters) {
    window.hotelFilters = { sort: 'asc', area: 'all', maxPrice: 400, limit: 6 };
  }
  const { sort, area, maxPrice, limit } = window.hotelFilters;

  // Filter
  let filtered = hotels.filter(h => {
    const matchesPrice = h.pricePerNight <= maxPrice;
    const matchesArea = area === 'all' || (h.area && h.area.toLowerCase().includes(area.toLowerCase()));
    return matchesPrice && matchesArea;
  });

  // Sort
  filtered.sort((a, b) => {
    return sort === 'asc' ? a.pricePerNight - b.pricePerNight : b.pricePerNight - a.pricePerNight;
  });

  const visibleHotels = filtered.slice(0, limit);
  const hasMore = filtered.length > limit;

  return `
    <div class="hotel-filter-toolbar">
      <div class="filter-controls-row">
        <div class="filter-group">
          <span class="filter-group-label"><i class="fa-solid fa-arrow-down-up-across-line"></i> Price Sort:</span>
          <div class="filter-sort-buttons">
            <button type="button" class="btn-filter-sort ${sort === 'asc' ? 'active' : ''}" onclick="handleHotelSort('asc')">
              <i class="fa-solid fa-arrow-down-short-wide"></i> Low ➔ High
            </button>
            <button type="button" class="btn-filter-sort ${sort === 'desc' ? 'active' : ''}" onclick="handleHotelSort('desc')">
              <i class="fa-solid fa-arrow-up-wide-short"></i> High ➔ Low
            </button>
          </div>
        </div>

        <div class="filter-group">
          <span class="filter-group-label"><i class="fa-solid fa-map-location-dot"></i> Area:</span>
          <select class="filter-select" id="hotelAreaSelect" onchange="handleHotelAreaFilter(this.value)">
            <option value="all" ${area === 'all' ? 'selected' : ''}>All Locations</option>
            <option value="Near Airport" ${area === 'Near Airport' ? 'selected' : ''}>✈️ Near Airport (Default)</option>
            <option value="City Center" ${area === 'City Center' ? 'selected' : ''}>🏙️ City Center</option>
            <option value="Downtown" ${area === 'Downtown' ? 'selected' : ''}>🌆 Downtown</option>
            <option value="Historic" ${area === 'Historic' ? 'selected' : ''}>🏛️ Historic District</option>
          </select>
        </div>

        <div class="filter-group filter-slider-group">
          <span class="filter-group-label"><i class="fa-solid fa-sliders"></i> Max Rate:</span>
          <input 
            type="range" 
            class="price-range-slider" 
            min="80" 
            max="400" 
            step="10" 
            value="${maxPrice}" 
            oninput="handleHotelPriceSlider(this.value)"
          />
          <span class="slider-val-badge" id="hotelSliderValBadge">$${maxPrice} / night</span>
        </div>
      </div>

      <div class="filter-stats-bar">
        <span>Showing <strong>${visibleHotels.length}</strong> of <strong>${filtered.length}</strong> matching stays (${hotels.length} total)</span>
        <button type="button" class="btn-skip-hotel" onclick="handleSkipHotel()">Skip Hotel Reservation ➔</button>
      </div>
    </div>

    <div class="cards-grid">
      ${visibleHotels.map((hotel) => {
        const originalIdx = window.cachedHotels.indexOf(hotel);
        const images = hotel.images && hotel.images.length > 0 ? hotel.images : [hotel.imageUrl];
        const currentIdx = hotel.currentImgIdx || 0;
        const currentImg = images[currentIdx] || hotel.imageUrl;

        return `
        <div class="hotel-card" data-hotel-id="${hotel.id}">
          <div class="hotel-carousel-container">
            <img src="${currentImg}" alt="${escapeHtml(hotel.name)}" class="hotel-carousel-img" loading="lazy" />
            
            ${images.length > 1 ? `
              <button type="button" class="carousel-btn prev" onclick="handleHotelPrevImage(event, ${originalIdx})" title="Previous photo">
                <i class="fa-solid fa-chevron-left"></i>
              </button>
              <button type="button" class="carousel-btn next" onclick="handleHotelNextImage(event, ${originalIdx})" title="Next photo">
                <i class="fa-solid fa-chevron-right"></i>
              </button>
              <div class="carousel-dots">
                ${images.map((_, dotIdx) => `
                  <span class="carousel-dot ${dotIdx === currentIdx ? 'active' : ''}"></span>
                `).join('')}
              </div>
            ` : ''}

            <div class="hotel-partner-badge"><i class="fa-solid fa-b"></i> Booking.com</div>
            <div class="hotel-rating-badge">★ ${hotel.starRating} Stars</div>
            ${hotel.area ? `<div class="hotel-area-badge">${hotel.area === 'Near Airport' ? '✈️ ' : ''}${escapeHtml(hotel.area)}</div>` : ''}
          </div>

          <div class="hotel-body">
            <div class="hotel-name">${escapeHtml(hotel.name)}</div>
            <div class="hotel-location">
              <i class="fa-solid fa-location-dot"></i> ${escapeHtml(hotel.address)}
            </div>
            ${hotel.distanceToAirport ? `<div class="hotel-distance-tag"><i class="fa-solid fa-plane-arrival"></i> ${escapeHtml(hotel.distanceToAirport)}</div>` : ''}

            <div class="bkg-review-box">
              <span class="review-score">${hotel.reviewScore}</span>
              <span class="review-label">${hotel.reviewRatingText}</span>
              <span class="review-count">(${hotel.reviewCount.toLocaleString()} reviews)</span>
            </div>

            <div class="amenities-row">
              ${hotel.amenities.slice(0, 3).map(a => `<span class="amenity-tag">${escapeHtml(a)}</span>`).join('')}
            </div>
          </div>

          <div class="hotel-footer">
            <div class="card-price">$${hotel.pricePerNight} <span>/ night ($${hotel.totalPrice} total)</span></div>
            <button type="button" class="btn-card-select" onclick="handleSelectHotel(${originalIdx})">
              Select Stay <i class="fa-solid fa-arrow-right"></i>
            </button>
          </div>
        </div>
      `}).join('')}
    </div>

    ${hasMore ? `
      <div class="hotel-pagination-container">
        <button type="button" class="btn-see-more" onclick="handleHotelSeeMore()">
          <i class="fa-solid fa-layer-group"></i> See More Accommodations (+${filtered.length - limit} more)
        </button>
      </div>
    ` : ''}
  `;
}

function updateHotelView() {
  const container = document.getElementById('hotelModuleWrapper');
  if (!container || !window.cachedHotels) return;
  container.innerHTML = renderHotelModuleContent(window.cachedHotels);
}

window.handleHotelSort = function(sortDir) {
  if (!window.hotelFilters) window.hotelFilters = { sort: 'asc', area: 'all', maxPrice: 400, limit: 6 };
  window.hotelFilters.sort = sortDir;
  updateHotelView();
};

window.handleHotelAreaFilter = function(area) {
  if (!window.hotelFilters) window.hotelFilters = { sort: 'asc', area: 'all', maxPrice: 400, limit: 6 };
  window.hotelFilters.area = area;
  updateHotelView();
};

window.handleHotelPriceSlider = function(val) {
  if (!window.hotelFilters) window.hotelFilters = { sort: 'asc', area: 'all', maxPrice: 400, limit: 6 };
  window.hotelFilters.maxPrice = parseInt(val, 10);
  const badge = document.getElementById('hotelSliderValBadge');
  if (badge) badge.innerText = `$${val} / night`;
  updateHotelView();
};

window.handleHotelSeeMore = function() {
  if (!window.hotelFilters) window.hotelFilters = { sort: 'asc', area: 'all', maxPrice: 400, limit: 6 };
  window.hotelFilters.limit += 6;
  updateHotelView();
};

window.handleHotelPrevImage = function(e, hotelIdx) {
  if (e) e.stopPropagation();
  const hotel = window.cachedHotels ? window.cachedHotels[hotelIdx] : null;
  if (!hotel) return;
  const imgs = hotel.images && hotel.images.length > 0 ? hotel.images : [hotel.imageUrl];
  if (imgs.length <= 1) return;

  hotel.currentImgIdx = (hotel.currentImgIdx !== undefined ? hotel.currentImgIdx : 0) - 1;
  if (hotel.currentImgIdx < 0) hotel.currentImgIdx = imgs.length - 1;

  const card = document.querySelector(`.hotel-card[data-hotel-id="${hotel.id}"]`);
  if (!card) return;
  const imgEl = card.querySelector('.hotel-carousel-img');
  if (imgEl) imgEl.src = imgs[hotel.currentImgIdx];

  card.querySelectorAll('.carousel-dot').forEach((dot, dIdx) => {
    dot.classList.toggle('active', dIdx === hotel.currentImgIdx);
  });
};

window.handleHotelNextImage = function(e, hotelIdx) {
  if (e) e.stopPropagation();
  const hotel = window.cachedHotels ? window.cachedHotels[hotelIdx] : null;
  if (!hotel) return;
  const imgs = hotel.images && hotel.images.length > 0 ? hotel.images : [hotel.imageUrl];
  if (imgs.length <= 1) return;

  hotel.currentImgIdx = ((hotel.currentImgIdx !== undefined ? hotel.currentImgIdx : 0) + 1) % imgs.length;

  const card = document.querySelector(`.hotel-card[data-hotel-id="${hotel.id}"]`);
  if (!card) return;
  const imgEl = card.querySelector('.hotel-carousel-img');
  if (imgEl) imgEl.src = imgs[hotel.currentImgIdx];

  card.querySelectorAll('.carousel-dot').forEach((dot, dIdx) => {
    dot.classList.toggle('active', dIdx === hotel.currentImgIdx);
  });
};

window.handleSkipHotel = function() {
  sendMessage('Skip hotel reservation', {
    action: 'SKIP_HOTEL'
  });
};

window.handleSelectHotel = function(idx) {
  const hotel = window.cachedHotels ? window.cachedHotels[idx] : null;
  if (!hotel) return;
  sendMessage(`Selected Hotel: ${hotel.name}`, {
    action: 'SELECT_HOTEL',
    item: hotel
  });
};

window.handleSwitchCabRoute = function(routeType) {
  window.currentCabRoute = routeType;
  const routeLabel = routeType === 'hotel_to_airport' 
    ? 'Hotel to Airport' 
    : routeType === 'custom' 
      ? 'Custom Location' 
      : 'Airport to Hotel';

  sendMessage(`Switch cab route: ${routeLabel}`, {
    action: 'SWITCH_CAB_ROUTE',
    routeType: routeType
  });
};

window.handleSelectCab = function(idx) {
  const cab = window.cachedCabs ? window.cachedCabs[idx] : null;
  if (!cab) return;
  sendMessage(`Selected Transfer: ${cab.vehicleType} ($${cab.price})`, {
    action: 'SELECT_CAB',
    item: cab
  });
};

window.handleSkipCab = function() {
  sendMessage('Skip airport transfer', {
    action: 'SKIP_CAB'
  });
};

window.selectedPaymentMethod = 'card';

window.handleOpenPaymentModal = function() {
  const modal = document.getElementById('paymentModal');
  if (!modal) {
    window.handleConfirmBooking();
    return;
  }

  const s = window.cachedSummary;
  if (s) {
    const totalEl = document.getElementById('modalTotalAmount');
    if (totalEl) totalEl.textContent = `$${s.totalCost.toFixed(2)} ${s.currency || 'USD'}`;
    const metaEl = document.getElementById('modalOrderMeta');
    if (metaEl) {
      metaEl.textContent = `Trip to ${s.destination || 'Destination'} (${s.dates || ''})`;
    }
  }

  modal.style.display = 'flex';
};

window.handleClosePaymentModal = function() {
  const modal = document.getElementById('paymentModal');
  if (modal) modal.style.display = 'none';
};

window.selectPaymentMethod = function(method) {
  window.selectedPaymentMethod = method;
  document.querySelectorAll('.method-option').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-method') === method);
  });

  const cardBox = document.getElementById('cardFieldsBox');
  if (cardBox) {
    cardBox.style.display = method === 'card' ? 'block' : 'none';
  }
};

window.handleExecutePayment = function() {
  const btn = document.getElementById('btnPayNow');
  if (btn) {
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing via Booking.com...';
    btn.disabled = true;
  }

  setTimeout(() => {
    window.handleClosePaymentModal();
    if (btn) {
      btn.innerHTML = '<i class="fa-solid fa-lock"></i> Pay & Authorize Booking';
      btn.disabled = false;
    }

    const methodLabels = {
      card: 'Credit Card (Visa)',
      paypal: 'PayPal Wallet',
      netbanking: 'Instant Bank Transfer / UPI'
    };

    sendMessage(`Payment authorized via Booking.com Payments (${methodLabels[window.selectedPaymentMethod] || 'Credit Card'}). Confirming booking!`, {
      action: 'CONFIRM_BOOKING',
      paymentMethod: methodLabels[window.selectedPaymentMethod] || 'Credit Card (Visa)'
    });
  }, 700);
};

window.handleConfirmBooking = function() {
  sendMessage('Confirm my travel reservation and issue official tickets', {
    action: 'CONFIRM_BOOKING',
    paymentMethod: 'Credit / Debit Card'
  });
};

// Workflow State Tracker
function updateWorkflowTracker(step) {
  const stepsOrder = ['INITIATION', 'FLIGHT_SELECTION', 'HOTEL_SELECTION', 'CAB_SELECTION', 'CHECKOUT_SUMMARY', 'CONFIRMED'];
  const currentIndex = stepsOrder.indexOf(step);

  stepsOrder.forEach((s, idx) => {
    const el = stepElements[s];
    if (!el) return;

    if (idx < currentIndex) {
      el.className = 'step-item completed';
    } else if (idx === currentIndex) {
      el.className = 'step-item active';
    } else {
      el.className = 'step-item';
    }
  });
}

function showTyping(show) {
  if (typingIndicator) {
    typingIndicator.style.display = show ? 'flex' : 'none';
    if (show) scrollToBottom();
  }
}

function scrollToBottom() {
  setTimeout(() => {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }, 50);
}

function formatMarkdown(text) {
  if (!text) return '';
  let html = escapeHtml(text);

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Italic
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  // Linebreaks
  html = html.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');

  return `<p>${html}</p>`;
}

function escapeHtml(unsafe) {
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
