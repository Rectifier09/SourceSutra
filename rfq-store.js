// Shared localStorage-backed RFQ + Quote store used by both the supplier and customer
// SourceSutra apps, so the award/reject loop is visible across separate page loads.
(function () {
  var RFQ_KEY = 'sourcesutra_rfqs_v3';
  var QUOTE_KEY = 'sourcesutra_quotes_v3';

  var SEED_RFQS = [
    { id: 'rfq1', title: 'Single-jersey T-shirts, basics line', category: "Men's Apparel", contractType: 'Cut-Make-Trim (CMT)', buyer: 'Vardhman Textiles', buyerLocation: 'Ludhiana, Punjab', quantity: 12000, unit: 'Pieces', bidStart: '2026-08-01', bidEnd: '2026-08-20', deliveryDate: '2026-10-15', deliveryLocation: 'Ludhiana, Punjab', primaryMaterial: '100% cotton knit, single jersey', gsm: '180', sizeRange: ['S', 'M', 'L', 'XL'], colours: ['Navy', 'Charcoal', 'White'], arrangement: 'Standard Product', customizationNeeds: [], requiredCerts: [{ category: 'Quality Management', name: 'ISO 9001', priority: 'must' }, { category: 'Social Compliance', name: 'SA8000', priority: 'nice' }], pricingApproach: 'Ask suppliers to quote', sampleRequired: true, sampleType: 'Fit', tags: ['Cut-Make-Trim (CMT)', 'Ludhiana'], status: 'active', publishedDate: '2026-08-01' },
    { id: 'rfq2', title: 'GOTS organic cotton basics capsule', category: 'Home Textiles', contractType: 'Full-package / white-label article', buyer: 'Vardhman Textiles', buyerLocation: 'Ludhiana, Punjab', quantity: 3000, unit: 'Pieces', bidStart: '2026-08-05', bidEnd: '2026-08-25', deliveryDate: '2026-11-01', deliveryLocation: 'Bengaluru, Karnataka', primaryMaterial: 'Organic cotton, 170 GSM', gsm: '170', sizeRange: ['XS', 'S', 'M', 'L'], colours: ['Natural', 'Sage'], arrangement: 'Private Label', customizationNeeds: ['Labels', 'Hangtags', 'Packaging'], requiredCerts: [{ category: 'Sustainable & Organic Textiles', name: 'GOTS', priority: 'must' }], pricingApproach: 'I have a target price', targetPrice: '380', currency: 'INR', sampleRequired: true, sampleType: 'Pre-production', tags: ['Full-package / white-label article', 'Bengaluru'], status: 'draft', publishedDate: '' },
    { id: 'rfq3', title: 'Reactive-dyed woven shirting, 60,000m', category: "Men's Apparel", contractType: 'Dyeing & processing', buyer: 'Raymond Sourcing', buyerLocation: 'Mumbai, Maharashtra', quantity: 60000, unit: 'Metres', bidStart: '2026-07-28', bidEnd: '2026-08-15', deliveryDate: '2026-09-30', deliveryLocation: 'Mumbai, Maharashtra', primaryMaterial: '100% cotton poplin', gsm: '120', sizeRange: [], colours: ['Sky blue', 'White', 'Pale pink'], arrangement: 'Standard Product', customizationNeeds: [], requiredCerts: [{ category: 'Environmental Management', name: 'ISO 14001', priority: 'nice' }], pricingApproach: 'Open to negotiation', sampleRequired: false, tags: ['Dyeing & processing', 'Mumbai'], status: 'active', publishedDate: '2026-07-28' },
    { id: 'rfq4', title: 'Terry towel white-label programme', category: 'Home Textiles', contractType: 'Full-package / white-label article', buyer: 'Welspun India', buyerLocation: 'Mumbai, Maharashtra', quantity: 400000, unit: 'Pieces', bidStart: '2026-08-10', bidEnd: '2026-09-05', deliveryDate: '2027-01-10', deliveryLocation: 'Anjar, Gujarat', primaryMaterial: 'Combed cotton terry, 500 GSM', gsm: '500', sizeRange: [], colours: ['White', 'Ivory'], arrangement: 'Private Label', customizationNeeds: ['Labels', 'Packaging'], requiredCerts: [{ category: 'Social Compliance', name: 'SA8000', priority: 'must' }, { category: 'Indian Regulatory & Legal Compliance', name: 'Factory Licence', priority: 'must' }], pricingApproach: 'Ask suppliers to quote', sampleRequired: true, sampleType: 'Production', tags: ['Full-package / white-label article', 'Anjar'], status: 'active', publishedDate: '2026-08-10' },
    { id: 'rfq5', title: 'Embroidered winter capsule, 12,000 pcs', category: 'Kids & Baby', contractType: 'Embroidery', buyer: 'Vardhman Textiles', buyerLocation: 'Ludhiana, Punjab', quantity: 12000, unit: 'Pieces', bidStart: '2026-06-03', bidEnd: '2026-06-22', deliveryDate: '2026-10-05', deliveryLocation: 'Delhi', primaryMaterial: 'Acrylic-wool blend knit', gsm: '', sizeRange: ['2-3Y', '4-5Y', '6-7Y'], colours: ['Maroon', 'Forest green'], arrangement: 'Custom Manufacturing', customizationNeeds: ['Embroidery', 'Labels'], requiredCerts: [], pricingApproach: 'I have a target price', targetPrice: '145', currency: 'INR', sampleRequired: true, sampleType: 'Proto', tags: ['Embroidery', 'Delhi'], status: 'lapsed', publishedDate: '2026-06-03' },
    { id: 'rfq6', title: 'Recycled polyester activewear fabric', category: 'Activewear', contractType: 'Fabric supply', buyer: 'FitCore Sportswear', buyerLocation: 'Chennai, Tamil Nadu', quantity: 25000, unit: 'Metres', bidStart: '2026-08-08', bidEnd: '2026-08-28', deliveryDate: '2026-10-20', deliveryLocation: 'Chennai, Tamil Nadu', primaryMaterial: 'Recycled polyester interlock', gsm: '210', sizeRange: [], colours: ['Black'], arrangement: 'Standard Product', customizationNeeds: [], requiredCerts: [{ category: 'Recycled Materials', name: 'GRS', priority: 'must' }], pricingApproach: 'Ask suppliers to quote', sampleRequired: false, tags: ['Fabric supply', 'Chennai'], status: 'active', publishedDate: '2026-08-08' },
    { id: 'rfq7', title: 'Denim jacket capsule, 4,000 pcs', category: 'Denim', contractType: 'Full-package / white-label article', buyer: 'Vardhman Textiles', buyerLocation: 'Ludhiana, Punjab', quantity: 4000, unit: 'Pieces', bidStart: '2026-06-01', bidEnd: '2026-06-18', deliveryDate: '2026-09-01', deliveryLocation: 'Ludhiana, Punjab', primaryMaterial: '100% cotton denim, 12oz', gsm: '', sizeRange: ['S', 'M', 'L'], colours: ['Indigo'], arrangement: 'Standard Product', customizationNeeds: [], requiredCerts: [], pricingApproach: 'Ask suppliers to quote', sampleRequired: true, sampleType: 'Fit', tags: ['Full-package / white-label article', 'Ludhiana'], status: 'foreclosed', publishedDate: '2026-06-01', closeReason: 'Buyer sourced this order in-house instead.' },
    { id: 'rfq8', title: 'Cotton-poly workwear uniforms, 8,000 sets', category: 'Workwear', contractType: 'Full-package / white-label article', buyer: 'Vardhman Textiles', buyerLocation: 'Ludhiana, Punjab', quantity: 8000, unit: 'Pieces', bidStart: '2026-05-01', bidEnd: '2026-05-20', deliveryDate: '2026-08-01', deliveryLocation: 'Ludhiana, Punjab', primaryMaterial: 'Cotton-poly twill, 220 GSM', gsm: '220', sizeRange: ['S', 'M', 'L', 'XL', 'XXL'], colours: ['Navy', 'Grey'], arrangement: 'Private Label', customizationNeeds: ['Labels', 'Hardware'], requiredCerts: [{ category: 'Quality Management', name: 'ISO 9001', priority: 'must' }], pricingApproach: 'Ask suppliers to quote', sampleRequired: true, sampleType: 'Pre-production', tags: ['Full-package / white-label article', 'Ludhiana'], status: 'awarded', publishedDate: '2026-05-01', awardedQuoteId: 'q5' }
  ];

  var SEED_QUOTES = [
    { id: 'q1', rfqId: 'rfq3', supplierId: 's_ludhiana_woolworks', supplierName: 'Ludhiana Woolworks', status: 'under_review', unitPrice: '118', currency: 'INR', priceBasis: 'Per metre', quantityFulfil: '60000', moq: '5000', bulkLeadTime: '25', incoterm: 'FOB', paymentTerms: '30% advance, 70% on shipment', quoteValidity: '2026-08-30', notes: 'Can match colour lab dips within 5 working days.', submittedDate: '2026-08-04', certsHeld: ['Environmental Management::ISO 14001'], customizationOffered: [] },
    { id: 'q2', rfqId: 'rfq1', supplierId: 's_anand_knitfab', supplierName: 'Anand Knitfab', status: 'submitted', unitPrice: '152', currency: 'INR', priceBasis: 'Per piece', quantityFulfil: '12000', moq: '2000', samplePrice: '45', sampleLeadTime: '6', bulkLeadTime: '22', incoterm: 'EXW', paymentTerms: '50% advance, 50% on delivery', quoteValidity: '2026-08-25', notes: 'Single-jersey capacity available immediately.', submittedDate: '2026-08-06', certsHeld: ['Quality Management::ISO 9001'], customizationOffered: [] },
    { id: 'q3', rfqId: 'rfq1', supplierId: 's_bhilwara_processors', supplierName: 'Bhilwara Processors', status: 'submitted', unitPrice: '148', currency: 'INR', priceBasis: 'Per piece', quantityFulfil: '10000', moq: '3000', samplePrice: '50', sampleLeadTime: '8', bulkLeadTime: '28', incoterm: 'FOB', paymentTerms: '30% advance, 70% on shipment', quoteValidity: '2026-08-22', notes: 'Can subcontract dyeing to a partner unit if needed.', submittedDate: '2026-08-07', certsHeld: [], customizationOffered: [] },
    { id: 'q4', rfqId: 'rfq1', supplierId: 's_erode_textile', supplierName: 'Erode Textile Exports', status: 'submitted', unitPrice: '160', currency: 'INR', priceBasis: 'Per piece', quantityFulfil: '12000', moq: '1500', samplePrice: '40', sampleLeadTime: '5', bulkLeadTime: '20', incoterm: 'FOB', paymentTerms: '40% advance, 60% on shipment', quoteValidity: '2026-08-28', notes: 'Fastest turnaround of our three units.', submittedDate: '2026-08-08', certsHeld: ['Quality Management::ISO 9001', 'Social Compliance::SA8000'], customizationOffered: [] },
    { id: 'q5', rfqId: 'rfq8', supplierId: 's_ludhiana_woolworks', supplierName: 'Ludhiana Woolworks', status: 'awarded', unitPrice: '410', currency: 'INR', priceBasis: 'Per piece', quantityFulfil: '8000', moq: '1000', samplePrice: '55', sampleLeadTime: '6', bulkLeadTime: '35', incoterm: 'FOB', paymentTerms: '30% advance, 70% on shipment', quoteValidity: '2026-05-18', notes: 'Twill sourced from our regular mill partner; consistent GSM guaranteed.', submittedDate: '2026-05-06', certsHeld: ['Quality Management::ISO 9001'], customizationOffered: ['Labels', 'Hardware'] },
    { id: 'q6', rfqId: 'rfq8', supplierId: 's_bhilwara_processors', supplierName: 'Bhilwara Processors', status: 'closed', unitPrice: '430', currency: 'INR', priceBasis: 'Per piece', quantityFulfil: '8000', moq: '2000', bulkLeadTime: '40', incoterm: 'FOB', paymentTerms: '50% advance, 50% on shipment', quoteValidity: '2026-05-15', notes: '', submittedDate: '2026-05-07', certsHeld: [], customizationOffered: ['Labels'] }
  ];

  function read(key, seed) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) { localStorage.setItem(key, JSON.stringify(seed)); return JSON.parse(JSON.stringify(seed)); }
      return JSON.parse(raw);
    } catch (e) { return JSON.parse(JSON.stringify(seed)); }
  }
  function write(key, data) { try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) {} }

  window.RFQStore = {
    getRfqs: function () { return read(RFQ_KEY, SEED_RFQS); },
    saveRfqs: function (list) { write(RFQ_KEY, list); },
    upsertRfq: function (rfq) {
      var list = this.getRfqs();
      var idx = list.findIndex(function (r) { return r.id === rfq.id; });
      if (idx >= 0) list[idx] = rfq; else list.push(rfq);
      this.saveRfqs(list);
      return rfq;
    },
    getQuotes: function () { return read(QUOTE_KEY, SEED_QUOTES); },
    saveQuotes: function (list) { write(QUOTE_KEY, list); },
    upsertQuote: function (quote) {
      var list = this.getQuotes();
      var idx = list.findIndex(function (q) { return q.id === quote.id; });
      if (idx >= 0) list[idx] = quote; else list.push(quote);
      this.saveQuotes(list);
      return quote;
    },
    deleteQuote: function (quoteId) {
      var list = this.getQuotes().filter(function (q) { return q.id !== quoteId; });
      this.saveQuotes(list);
    },
    // Award quoteId's RFQ to that quote: flips RFQ to awarded, that quote to awarded,
    // every other quote on the same RFQ to closed.
    awardQuote: function (quoteId) {
      var quotes = this.getQuotes();
      var target = quotes.find(function (q) { return q.id === quoteId; });
      if (!target) return;
      quotes = quotes.map(function (q) {
        if (q.id === quoteId) return Object.assign({}, q, { status: 'awarded' });
        if (q.rfqId === target.rfqId) return Object.assign({}, q, { status: 'closed' });
        return q;
      });
      this.saveQuotes(quotes);
      var rfqs = this.getRfqs().map(function (r) { return r.id === target.rfqId ? Object.assign({}, r, { status: 'awarded', awardedQuoteId: quoteId }) : r; });
      this.saveRfqs(rfqs);
    },
    // Reject a single quote; RFQ stays active.
    rejectQuote: function (quoteId, reason) {
      var quotes = this.getQuotes().map(function (q) { return q.id === quoteId ? Object.assign({}, q, { status: 'not_selected', rejectReason: reason || '' }) : q; });
      this.saveQuotes(quotes);
    },
    // Buyer closes an RFQ early (foreclosed) before its bid window ends.
    forecloseRfq: function (rfqId, reason) {
      var rfqs = this.getRfqs().map(function (r) { return r.id === rfqId ? Object.assign({}, r, { status: 'foreclosed', closeReason: reason || '' }) : r; });
      this.saveRfqs(rfqs);
    },
    // Buyer reopens/extends a lapsed RFQ's bid window.
    reopenRfq: function (rfqId, newBidEnd) {
      var rfqs = this.getRfqs().map(function (r) { return r.id === rfqId ? Object.assign({}, r, { status: 'active', bidEnd: newBidEnd || r.bidEnd }) : r; });
      this.saveRfqs(rfqs);
    }
  };
})();
