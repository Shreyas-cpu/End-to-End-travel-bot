import { bookingComProvider } from '../src/providers/hotel/bookingComProvider';
import { bookingComPaymentProvider } from '../src/providers/payment/bookingComPaymentProvider';
import { cabTransferProvider } from '../src/providers/cab/transferProvider';
import { adminConfigService } from '../src/services/adminConfigService';

async function runBookingComCompatibilityTests() {
  console.log('================================================================');
  console.log('🏨 RUNNING BOOKING.COM DEMAND API v3.2 COMPATIBILITY TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (condition) {
      console.log(`  ✔ [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`  ✖ [FAIL] ${msg}`);
      throw new Error(`Assertion failed: ${msg}`);
    }
  }

  // 1. Test Location Resolution
  console.log('1️⃣ Location & Airport Resolution (Demand API 3.2 requirement)');
  const parisLoc = bookingComProvider.resolveLocation('Paris');
  assert(parisLoc.airport === 'CDG' && parisLoc.country === 'FR', 'Resolves Paris to CDG airport and FR country');

  const tokyoLoc = bookingComProvider.resolveLocation('Tokyo');
  assert(tokyoLoc.airport === 'HND' && tokyoLoc.country === 'JP', 'Resolves Tokyo to HND airport and JP country');

  const iataLoc = bookingComProvider.resolveLocation('AMS');
  assert(iataLoc.airport === 'AMS', 'Resolves direct 3-letter IATA code AMS');

  const parenLoc = bookingComProvider.resolveLocation('London (LHR)');
  assert(parenLoc.airport === 'LHR', 'Resolves airport code from parenthetical string "London (LHR)"');

  // 2. Test Headers Construction
  console.log('\n2️⃣ Authentication & Headers (BearerAuth + X-Affiliate-Id)');
  process.env.BOOKING_COM_API_KEY = 'test_token_demand_api_v32';
  process.env.BOOKING_COM_AFFILIATE_ID = '98765432';

  const headers = bookingComProvider.getHeaders();
  assert(headers['Authorization'] === 'Bearer test_token_demand_api_v32', 'Headers include Bearer Authorization token');
  assert(headers['X-Affiliate-Id'] === '98765432', 'Headers include required X-Affiliate-Id');

  // 3. Test Two-Step Search + Details Enrichment Lifecycle
  console.log('\n3️⃣ Demand API v3.2 Accommodation Search & Static Details Merging');
  const originalFetch = global.fetch;

  let searchBodyReceived: any = null;
  let detailsBodyReceived: any = null;

  global.fetch = async (url: any, init: any): Promise<any> => {
    const urlStr = String(url);

    if (urlStr.includes('/accommodations/search')) {
      searchBodyReceived = JSON.parse(init.body);
      return {
        ok: true,
        json: async () => ({
          request_id: 'req_search_v32_01',
          data: [
            {
              id: 10004,
              currency: { accommodation: 'EUR', booker: 'EUR' },
              products: [
                {
                  id: 'prod_10004_deluxe',
                  price: {
                    display: { value: 165.50, currency: 'EUR' },
                    base: { accommodation_currency: 150.00 }
                  },
                  policies: {
                    cancellation: { type: 'free_cancellation' },
                    meal_plan: { plan: 'breakfast_included' }
                  }
                }
              ],
              deep_link_url: 'booking://hotel/10004?affiliate_id=98765432'
            }
          ]
        })
      };
    }

    if (urlStr.includes('/accommodations/details')) {
      detailsBodyReceived = JSON.parse(init.body);
      return {
        ok: true,
        json: async () => ({
          request_id: 'req_details_v32_01',
          data: [
            {
              id: 10004,
              name: {
                'en-gb': 'The Grand Canal Luxury Residence',
                'en-us': 'The Grand Canal Luxury Residence'
              },
              location: {
                address: {
                  'en-gb': '104 Oudezijds Voorburgwal, Amsterdam',
                  'en-us': '104 Oudezijds Voorburgwal, Amsterdam'
                }
              },
              rating: {
                stars: 5,
                review_score: 9.3,
                number_of_reviews: 2480
              },
              photos: [
                {
                  main_photo: true,
                  url: {
                    large: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1280',
                    standard: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500'
                  }
                },
                {
                  url: {
                    large: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=1280'
                  }
                }
              ],
              checkin_checkout_times: {
                checkin_from: '15:00:00',
                checkout_to: '11:00:00'
              }
            }
          ]
        })
      };
    }

    if (urlStr.includes('/orders/preview')) {
      return {
        ok: true,
        json: async () => ({
          request_id: 'req_preview_01',
          data: {
            order_token: 'ord_tok_v32_valid_token_abc123',
            accommodation: {
              id: 10004,
              price: {
                base: { accommodation_currency: 600.00 },
                total: { accommodation_currency: 672.00 }
              }
            }
          }
        })
      };
    }

    if (urlStr.includes('/orders/create')) {
      return {
        ok: true,
        json: async () => ({
          request_id: 'req_create_01',
          order: '509430129718799',
          data: {
            accommodation: {
              reservation: '99887766',
              pincode: '4321'
            },
            payment: {
              receipt_url: 'https://secure.booking.com/receipt.html?bn=99887766'
            }
          }
        })
      };
    }

    if (urlStr.includes('/accommodations/constants')) {
      return {
        ok: true,
        json: async () => ({
          request_id: 'req_constants_01',
          data: {
            accommodation_facilities: [{ id: 1, name: 'Free WiFi' }]
          }
        })
      };
    }

    if (urlStr.includes('/cars/search')) {
      return {
        ok: true,
        json: async () => ({
          request_id: 'req_cars_01',
          data: [
            {
              car: 5544,
              offer: 887766,
              supplier: 21,
              price: { total: { amount: 68.50, currency: 'USD' } }
            }
          ]
        })
      };
    }

    return originalFetch(url, init);
  };

  try {
    process.env.HOTEL_PROVIDER = 'booking_com';
    const enrichedHotels = await bookingComProvider.searchAccommodations({ destination: 'Amsterdam' });

    assert(searchBodyReceived !== null, 'Sent /accommodations/search request to Booking.com');
    assert(searchBodyReceived.airport === 'AMS', 'Demand API search payload includes resolved airport "AMS"');
    assert(searchBodyReceived.booker.platform === 'desktop', 'Demand API search payload includes required booker.platform');
    assert(detailsBodyReceived !== null, 'Sent /accommodations/details request to enrich properties');
    assert(detailsBodyReceived.accommodations.includes(10004), 'Details request queried accommodation ID 10004');
    assert(enrichedHotels.length === 1, 'Returns parsed accommodation');
    assert(enrichedHotels[0].name === 'The Grand Canal Luxury Residence', 'Mapped translated hotel name from details');
    assert(enrichedHotels[0].address.includes('Amsterdam'), 'Mapped translated hotel address from details');
    assert(enrichedHotels[0].starRating === 5, 'Mapped 5-star rating from details');
    assert(enrichedHotels[0].reviewScore === 9.3, 'Mapped review score 9.3 from details');
    assert(enrichedHotels[0].pricePerNight === 165.50, 'Mapped display price per night from search product');
    assert(enrichedHotels[0].breakfastIncluded === true, 'Parsed meal plan policy (breakfast_included)');
    assert(enrichedHotels[0].cancellationPolicy.includes('Free cancellation'), 'Parsed free cancellation policy');
    assert(enrichedHotels[0].images.length >= 2, 'Mapped photo gallery from accommodationDetail');

    // 4. Test Orders Preview
    console.log('\n4️⃣ Demand API v3.2 Orders Preview (/orders/preview)');
    const previewRes = await bookingComProvider.previewOrder(enrichedHotels[0], {
      checkin: '2026-10-15',
      checkout: '2026-10-19',
      guests: 2
    });
    assert(previewRes.orderToken === 'ord_tok_v32_valid_token_abc123', 'Extracted valid order_token from /orders/preview');
    assert(previewRes.price === 600.00, 'Parsed base price from /orders/preview');
    assert(previewRes.total === 672.00, 'Parsed total price with taxes from /orders/preview');

    // 5. Test Orders Create
    console.log('\n5️⃣ Demand API v3.2 Orders Create (/orders/create)');
    const orderRes = await bookingComProvider.createOrder({
      orderToken: previewRes.orderToken,
      booker: {
        firstName: 'Sarah',
        lastName: 'Connor',
        email: 'sarah@example.com'
      }
    });
    assert(orderRes.orderId === '509430129718799', 'Parsed order ID from /orders/create response');
    assert(orderRes.reservationId === '99887766', 'Parsed reservation ID from /orders/create response');
    assert(orderRes.pincode === '4321', 'Parsed confirmation pincode from /orders/create response');
    assert(orderRes.receiptUrl?.includes('receipt.html'), 'Parsed receipt URL from /orders/create response');

    // 6. Test Admin Connection Diagnostics
    console.log('\n6️⃣ Admin Connection Diagnostics via Constants Endpoint');
    const diag = await adminConfigService.testConnection('booking_com', {
      apiKey: 'test_live_key',
      affiliateId: '12345'
    });
    assert(diag.success === true, 'Admin connection test succeeds using /accommodations/constants');
    assert(diag.status === 'Connected & Active', 'Status marked Connected & Active');

    // 7. Test Cars / Ground Transfer via Demand API Cars
    console.log('\n7️⃣ Ground Transfers via Demand API Cars (/cars/search)');
    process.env.CAB_PROVIDER = 'booking_com';
    const cars = await cabTransferProvider.getTransferOptions('Amsterdam');
    assert(cars.length > 0, 'Retrieved transfer options using Booking.com Cars engine');
    assert(cars[0].id.includes('cab-bkg-'), 'Cab transfers formatted with Booking.com partner ID');

  } finally {
    global.fetch = originalFetch;
    delete process.env.BOOKING_COM_API_KEY;
    delete process.env.BOOKING_COM_AFFILIATE_ID;
    process.env.HOTEL_PROVIDER = 'mock';
    process.env.CAB_PROVIDER = 'mock';
  }

  console.log('\n================================================================');
  console.log(`🎉 ALL ${passed}/${total} BOOKING.COM COMPATIBILITY TESTS PASSED (100%)`);
  console.log('================================================================\n');
}

runBookingComCompatibilityTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
