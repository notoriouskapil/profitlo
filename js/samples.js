/**
 * Profitlo — sample businesses for quick demos.
 * One clear profit case, one loss case (high platform fees) and one
 * under-priced case, so every dashboard state can be shown in class.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ProfitloSamples = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  return [
    {
      id: 'candles',
      label: 'Aroma Candle Co. — profitable',
      data: {
        businessName: 'Aroma Candle Co.',
        productName: 'Hand-poured soy candle (200 g)',
        currency: 'INR',
        equipment: 25000,
        registration: 5000,
        setup: 15000,
        marketing: 10000,
        otherStartup: 5000,
        inventoryUnits: 200,
        rawMaterials: 85,
        packaging: 20,
        labor: 30,
        delivery: 25,
        otherUnit: 5,
        rent: 8000,
        salaries: 18000,
        utilities: 2500,
        subscriptions: 1500,
        otherMonthly: 3000,
        price: 399,
        units: 250,
        feePercent: 3,
        taxPercent: 5,
        targetMargin: 20,
      },
    },
    {
      id: 'tiffin',
      label: 'Dabba Express tiffins — loss (high app fees)',
      data: {
        businessName: 'Dabba Express',
        productName: 'Home-style veg tiffin',
        currency: 'INR',
        equipment: 80000,
        registration: 7500,
        setup: 40000,
        marketing: 20000,
        otherStartup: 10000,
        inventoryUnits: 100,
        rawMaterials: 55,
        packaging: 12,
        labor: 15,
        delivery: 25,
        otherUnit: 3,
        rent: 15000,
        salaries: 30000,
        utilities: 6000,
        subscriptions: 2000,
        otherMonthly: 4000,
        price: 150,
        units: 1500,
        feePercent: 18,
        taxPercent: 5,
        targetMargin: 15,
      },
    },
    {
      id: 'soap',
      label: 'Kraft Soap Studio — under-priced',
      data: {
        businessName: 'Kraft Soap Studio',
        productName: 'Handmade herbal soap bar',
        currency: 'INR',
        equipment: 12000,
        registration: 3000,
        setup: 5000,
        marketing: 6000,
        otherStartup: 2000,
        inventoryUnits: 150,
        rawMaterials: 60,
        packaging: 18,
        labor: 25,
        delivery: 30,
        otherUnit: 2,
        rent: 4000,
        salaries: 6000,
        utilities: 1000,
        subscriptions: 500,
        otherMonthly: 500,
        price: 120,
        units: 250,
        feePercent: 2,
        taxPercent: 0,
        targetMargin: 20,
      },
    },
  ];
});
