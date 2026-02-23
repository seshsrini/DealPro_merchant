/**
 * formSchema.ts
 * Dynamic field definitions for each merchant category.
 * Drives the ProductCatalog DealForm rendering engine.
 */

export type FieldType = 'text' | 'number' | 'select' | 'date' | 'boolean' | 'textarea';

export interface FieldDefinition {
  key: string;         // unique key for form state
  label: string;       // display label
  type: FieldType;
  placeholder?: string;
  options?: string[];  // for select type
  required?: boolean;
  unit?: string;       // suffix display (e.g. "kg", "ml")
  apiFieldMap?: string; // maps to a key in the API's product response
}

export interface CategorySchema {
  id: string;
  label: string;
  apiSource: 'openfoodfacts' | 'upcitemdb' | 'openlibrary' | null;
  searchMode: 'barcode' | 'name' | 'both';
  fields: FieldDefinition[];
}

export const CATEGORY_SCHEMAS: CategorySchema[] = [
  {
    id: 'grocery',
    label: 'Grocery / Food & Beverage',
    apiSource: 'openfoodfacts',
    searchMode: 'both',
    fields: [
      { key: 'brand',       label: 'Brand',        type: 'text',   placeholder: 'e.g. Amul, Nestlé',    apiFieldMap: 'brands'         },
      { key: 'weight',      label: 'Net Weight',   type: 'text',   placeholder: 'e.g. 500',              unit: 'g / ml',               apiFieldMap: 'quantity'       },
      { key: 'category',    label: 'Sub-Category', type: 'select', options: ['Dairy', 'Beverages', 'Snacks', 'Grains & Pulses', 'Fruits & Vegetables', 'Frozen', 'Condiments', 'Other'] },
      { key: 'expiry_info', label: 'Shelf Life',   type: 'text',   placeholder: 'e.g. 6 months from manufacture' },
      { key: 'dietary',     label: 'Dietary Tags', type: 'text',   placeholder: 'e.g. Vegan, Gluten-Free, Organic', apiFieldMap: 'labels' },
      { key: 'ingredients', label: 'Key Ingredients', type: 'textarea', placeholder: 'Main ingredients...', apiFieldMap: 'ingredients_text' },
    ],
  },
  {
    id: 'restaurant',
    label: 'Restaurant / F&B Service',
    apiSource: null,
    searchMode: 'name',
    fields: [
      { key: 'cuisine',     label: 'Cuisine Type', type: 'select', options: ['Indian', 'Chinese', 'Continental', 'South Indian', 'North Indian', 'Italian', 'Mexican', 'Japanese', 'Street Food', 'Bakery', 'Other'], required: true },
      { key: 'meal_type',   label: 'Meal Type',    type: 'select', options: ['Breakfast', 'Lunch', 'Dinner', 'Snacks & Tea', 'All Day'] },
      { key: 'serves',      label: 'Serves',       type: 'number', placeholder: 'Number of persons', unit: 'pax' },
      { key: 'dietary',     label: 'Dietary',      type: 'select', options: ['Veg Only', 'Non-Veg', 'Veg & Non-Veg', 'Jain', 'Vegan Friendly'] },
      { key: 'delivery',    label: 'Delivery Available', type: 'boolean' },
      { key: 'min_order',   label: 'Min Order Value', type: 'number', placeholder: '0', unit: '₹' },
    ],
  },
  {
    id: 'electronics',
    label: 'Electronics & Appliances',
    apiSource: 'upcitemdb',
    searchMode: 'both',
    fields: [
      { key: 'brand',       label: 'Brand',        type: 'text',   placeholder: 'e.g. Samsung, LG',      apiFieldMap: 'brand'          },
      { key: 'model',       label: 'Model Number', type: 'text',   placeholder: 'e.g. Galaxy A54',        apiFieldMap: 'model'          },
      { key: 'sub_category',label: 'Type',         type: 'select', options: ['Smartphone', 'Laptop', 'TV', 'Tablet', 'Headphones', 'Camera', 'Refrigerator', 'Washing Machine', 'AC', 'Other'] },
      { key: 'warranty',    label: 'Warranty',     type: 'select', options: ['No Warranty', '3 Months', '6 Months', '1 Year', '2 Years', '3 Years', '5 Years'] },
      { key: 'color',       label: 'Color / Variant', type: 'text', placeholder: 'e.g. Midnight Black' },
      { key: 'mrp',         label: 'MRP',          type: 'number', placeholder: '0', unit: '₹' },
    ],
  },
  {
    id: 'fashion',
    label: 'Fashion & Apparel',
    apiSource: null,
    searchMode: 'name',
    fields: [
      { key: 'brand',       label: 'Brand',        type: 'text',   placeholder: 'e.g. Zara, Fabindia'                                  },
      { key: 'category',    label: 'Category',     type: 'select', options: ['Men\'s Wear', 'Women\'s Wear', 'Kids', 'Footwear', 'Accessories', 'Ethnic Wear', 'Sportswear', 'Other'] },
      { key: 'sizes',       label: 'Available Sizes', type: 'text', placeholder: 'e.g. S, M, L, XL or 36-42'                          },
      { key: 'material',    label: 'Material',     type: 'text',   placeholder: 'e.g. 100% Cotton, Polyester Blend'                    },
      { key: 'color',       label: 'Colors',       type: 'text',   placeholder: 'e.g. Red, Blue, White'                               },
      { key: 'gender',      label: 'Gender',       type: 'select', options: ['Unisex', 'Men', 'Women', 'Boys', 'Girls', 'Infant']     },
    ],
  },
  {
    id: 'beauty',
    label: 'Beauty & Personal Care',
    apiSource: 'openfoodfacts',
    searchMode: 'both',
    fields: [
      { key: 'brand',       label: 'Brand',        type: 'text',   placeholder: 'e.g. Lakme, Himalaya',  apiFieldMap: 'brands'         },
      { key: 'volume',      label: 'Volume / Weight', type: 'text', placeholder: 'e.g. 200',             unit: 'ml / g', apiFieldMap: 'quantity' },
      { key: 'skin_type',   label: 'Skin Type',    type: 'select', options: ['All Skin Types', 'Oily', 'Dry', 'Combination', 'Sensitive', 'Normal'] },
      { key: 'category',    label: 'Category',     type: 'select', options: ['Skincare', 'Haircare', 'Makeup', 'Fragrance', 'Men\'s Grooming', 'Oral Care', 'Body Care', 'Other'] },
      { key: 'key_ingredients', label: 'Key Ingredients', type: 'text', placeholder: 'e.g. Vitamin C, Hyaluronic Acid' },
      { key: 'spf',         label: 'SPF',          type: 'number', placeholder: 'Leave blank if N/A'     },
    ],
  },
  {
    id: 'health',
    label: 'Health & Wellness',
    apiSource: null,
    searchMode: 'name',
    fields: [
      { key: 'brand',       label: 'Brand / Manufacturer', type: 'text', placeholder: 'e.g. Apollo, Cipla' },
      { key: 'category',    label: 'Category',     type: 'select', options: ['Supplements', 'Ayurvedic', 'Fitness Equipment', 'Medical Devices', 'OTC Medicine', 'Yoga / Meditation', 'Other'] },
      { key: 'dosage_form', label: 'Form',         type: 'select', options: ['Tablet', 'Capsule', 'Syrup', 'Powder', 'Cream / Gel', 'Device', 'Other'] },
      { key: 'quantity',    label: 'Pack Size',    type: 'text',   placeholder: 'e.g. 60 Tablets, 500g'  },
      { key: 'age_group',   label: 'Age Group',    type: 'select', options: ['All Ages', 'Adults', 'Seniors', 'Children', 'Infants'] },
      { key: 'prescription',label: 'Prescription Required', type: 'boolean'                              },
    ],
  },
  {
    id: 'books',
    label: 'Books & Stationery',
    apiSource: 'openlibrary',
    searchMode: 'both',
    fields: [
      { key: 'author',      label: 'Author',       type: 'text',   placeholder: 'Author name',            apiFieldMap: 'author_name'   },
      { key: 'isbn',        label: 'ISBN',         type: 'text',   placeholder: '13-digit ISBN'           },
      { key: 'publisher',   label: 'Publisher',    type: 'text',   placeholder: 'Publisher name',         apiFieldMap: 'publisher'     },
      { key: 'genre',       label: 'Genre',        type: 'select', options: ['Fiction', 'Non-Fiction', 'Self-Help', 'Business', 'Science', 'Children', 'Academic', 'Comics', 'Biography', 'Other'] },
      { key: 'language',    label: 'Language',     type: 'select', options: ['English', 'Hindi', 'Kannada', 'Tamil', 'Telugu', 'Malayalam', 'Bengali', 'Marathi', 'Gujarati', 'Other'] },
      { key: 'edition',     label: 'Edition / Year', type: 'text', placeholder: 'e.g. 3rd Ed. 2023',      apiFieldMap: 'publish_year'  },
    ],
  },
  {
    id: 'home',
    label: 'Home & Living',
    apiSource: 'upcitemdb',
    searchMode: 'both',
    fields: [
      { key: 'brand',       label: 'Brand',        type: 'text',   placeholder: 'e.g. IKEA, Prestige',   apiFieldMap: 'brand'         },
      { key: 'category',    label: 'Category',     type: 'select', options: ['Furniture', 'Kitchen & Dining', 'Decor', 'Cleaning', 'Bedding & Bath', 'Lighting', 'Storage', 'Garden', 'Other'] },
      { key: 'material',    label: 'Material',     type: 'text',   placeholder: 'e.g. Stainless Steel, Solid Wood' },
      { key: 'dimensions',  label: 'Dimensions',   type: 'text',   placeholder: 'L × W × H'              },
      { key: 'color',       label: 'Color / Finish', type: 'text', placeholder: 'e.g. Matte Black'       },
      { key: 'warranty',    label: 'Warranty',     type: 'select', options: ['No Warranty', '3 Months', '1 Year', '2 Years', '5 Years', 'Lifetime'] },
    ],
  },
  {
    id: 'automotive',
    label: 'Automotive',
    apiSource: null,
    searchMode: 'name',
    fields: [
      { key: 'brand',       label: 'Brand',        type: 'text',   placeholder: 'e.g. MRF, Ceat, Michelin' },
      { key: 'product_type',label: 'Product Type', type: 'select', options: ['Tires', 'Batteries', 'Engine Oil', 'Spare Parts', 'Accessories', 'Car Care', 'Other'] },
      { key: 'vehicle_type',label: 'Vehicle Type', type: 'select', options: ['Car', 'Bike', 'SUV/Truck', 'Commercial Vehicle', 'Universal'] },
      { key: 'model_fit',   label: 'Compatible Models', type: 'text', placeholder: 'e.g. Honda City, Maruti Swift' },
      { key: 'warranty',    label: 'Warranty',     type: 'select', options: ['No Warranty', '6 Months', '1 Year', '2 Years', '3 Years', '5 Years'] },
      { key: 'condition',   label: 'Condition',    type: 'select', options: ['New', 'Refurbished', 'Used - Like New', 'Used - Good'] },
    ],
  },
  {
    id: 'tires',
    label: 'Tires',
    apiSource: null,
    searchMode: 'name',
    fields: [
      { key: 'brand',       label: 'Brand',        type: 'text',   placeholder: 'e.g. MRF, Ceat, Apollo, Michelin' },
      { key: 'tire_type',   label: 'Tire Type',    type: 'select', options: ['Tubeless', 'Tube-Type', 'Run-Flat'] },
      { key: 'width',       label: 'Width',        type: 'number', placeholder: 'e.g. 195', unit: 'mm' },
      { key: 'aspect_ratio',label: 'Aspect Ratio', type: 'number', placeholder: 'e.g. 65' },
      { key: 'rim_size',    label: 'Rim Size',     type: 'number', placeholder: 'e.g. 15', unit: 'inches' },
      { key: 'vehicle_type',label: 'Vehicle Type', type: 'select', options: ['Car', 'Bike', 'SUV', 'Truck', 'Scooter'] },
      { key: 'load_index',  label: 'Load Index',   type: 'text',   placeholder: 'e.g. 91' },
      { key: 'speed_rating',label: 'Speed Rating', type: 'select', options: ['H (210 km/h)', 'V (240 km/h)', 'W (270 km/h)', 'Y (300 km/h)', 'T (190 km/h)', 'S (180 km/h)'] },
      { key: 'warranty',    label: 'Warranty',     type: 'select', options: ['No Warranty', '1 Year', '2 Years', '3 Years', '5 Years', 'Lifetime Tread'] },
      { key: 'condition',   label: 'Condition',    type: 'select', options: ['New', 'Refurbished', 'Used - Like New'] },
    ],
  },
  {
    id: 'sports',
    label: 'Sports & Fitness',
    apiSource: null,
    searchMode: 'name',
    fields: [
      { key: 'brand',       label: 'Brand',        type: 'text',   placeholder: 'e.g. Nike, Adidas, Decathlon' },
      { key: 'category',    label: 'Category',     type: 'select', options: ['Footwear', 'Apparel', 'Equipment', 'Accessories', 'Supplements', 'Yoga & Meditation', 'Outdoor & Adventure', 'Other'] },
      { key: 'sport',       label: 'Sport',        type: 'select', options: ['Gym / Fitness', 'Running', 'Cricket', 'Football', 'Badminton', 'Tennis', 'Yoga', 'Swimming', 'Cycling', 'Basketball', 'Other'] },
      { key: 'size',        label: 'Size',         type: 'text',   placeholder: 'e.g. M, L, XL or 42, 44' },
      { key: 'gender',      label: 'Gender',       type: 'select', options: ['Unisex', 'Men', 'Women', 'Kids'] },
      { key: 'warranty',    label: 'Warranty',     type: 'select', options: ['No Warranty', '3 Months', '6 Months', '1 Year', '2 Years'] },
    ],
  },
  {
    id: 'jewellery',
    label: 'Jewellery',
    apiSource: null,
    searchMode: 'name',
    fields: [
      { key: 'type',        label: 'Type',         type: 'select', options: ['Necklace', 'Earrings', 'Ring', 'Bracelet', 'Anklet', 'Pendant', 'Mangalsutra', 'Bangles', 'Nose Pin', 'Chain', 'Other'] },
      { key: 'material',    label: 'Material',     type: 'select', options: ['Gold', 'Silver', 'Platinum', 'Diamond', 'Gold-Plated', 'Artificial / Imitation', 'Gemstone', 'Other'] },
      { key: 'purity',      label: 'Purity',       type: 'select', options: ['24K', '22K', '18K', '14K', '92.5% (Sterling)', 'N/A'] },
      { key: 'weight',      label: 'Weight',       type: 'number', placeholder: 'e.g. 5.5', unit: 'grams' },
      { key: 'occasion',    label: 'Occasion',     type: 'select', options: ['Daily Wear', 'Wedding', 'Party / Festive', 'Traditional', 'Modern / Trendy', 'Gifts'] },
      { key: 'gender',      label: 'For',          type: 'select', options: ['Women', 'Men', 'Kids', 'Unisex'] },
      { key: 'certification',label: 'Certification', type: 'text', placeholder: 'e.g. BIS Hallmark, GIA' },
    ],
  },
  {
    id: 'toys',
    label: 'Toys & Games',
    apiSource: null,
    searchMode: 'name',
    fields: [
      { key: 'brand',       label: 'Brand',        type: 'text',   placeholder: 'e.g. Lego, Hasbro, Funskool' },
      { key: 'category',    label: 'Category',     type: 'select', options: ['Action Figures', 'Dolls', 'Building Blocks', 'Board Games', 'Educational', 'Outdoor Play', 'Soft Toys', 'Electronic Toys', 'Puzzles', 'Other'] },
      { key: 'age_range',   label: 'Age Range',    type: 'select', options: ['0-2 Years', '3-5 Years', '6-8 Years', '9-12 Years', '13+ Years'] },
      { key: 'material',    label: 'Material',     type: 'text',   placeholder: 'e.g. Plastic, Wood, Fabric' },
      { key: 'battery',     label: 'Battery Required', type: 'boolean' },
      { key: 'safety',      label: 'Safety Certified', type: 'boolean' },
    ],
  },
  {
    id: 'furniture',
    label: 'Furniture',
    apiSource: null,
    searchMode: 'name',
    fields: [
      { key: 'brand',       label: 'Brand',        type: 'text',   placeholder: 'e.g. IKEA, Godrej, Pepperfry' },
      { key: 'category',    label: 'Category',     type: 'select', options: ['Sofa & Seating', 'Bed', 'Wardrobe', 'Table', 'Chair', 'Storage', 'Outdoor', 'Office', 'Other'] },
      { key: 'material',    label: 'Material',     type: 'select', options: ['Solid Wood', 'Engineered Wood', 'Metal', 'Plastic', 'Glass', 'Fabric', 'Leather', 'Mixed'] },
      { key: 'dimensions',  label: 'Dimensions',   type: 'text',   placeholder: 'L × W × H in cm or inches' },
      { key: 'color',       label: 'Color / Finish', type: 'text', placeholder: 'e.g. Walnut Brown, Matte Black' },
      { key: 'assembly',    label: 'Assembly Required', type: 'boolean' },
      { key: 'warranty',    label: 'Warranty',     type: 'select', options: ['No Warranty', '6 Months', '1 Year', '2 Years', '5 Years', '10 Years'] },
    ],
  },
  {
    id: 'general',
    label: 'General / Services',
    apiSource: null,
    searchMode: 'name',
    fields: [
      { key: 'service_type',label: 'Type',         type: 'text',   placeholder: 'e.g. Dry Cleaning, Car Wash, Salon' },
      { key: 'duration',    label: 'Duration',     type: 'text',   placeholder: 'e.g. 45 minutes, 1 hour', unit: '' },
      { key: 'availability',label: 'Availability', type: 'text',   placeholder: 'e.g. Mon–Sat, 9AM–7PM'   },
      { key: 'for_whom',    label: 'For',          type: 'select', options: ['Everyone', 'Men', 'Women', 'Kids', 'Seniors', 'Couples'] },
      { key: 'booking',     label: 'Booking Required', type: 'boolean'                                    },
      { key: 'notes',       label: 'Additional Notes', type: 'textarea', placeholder: 'Any conditions or details...' },
    ],
  },
];

/** Find a schema by merchant category string (case-insensitive partial match). */
export function getSchemaForCategory(category: string): CategorySchema {
  const lower = category.toLowerCase();
  const match = CATEGORY_SCHEMAS.find(s =>
    lower.includes(s.id) ||
    s.label.toLowerCase().includes(lower) ||
    lower.includes(s.label.toLowerCase().split(' ')[0])
  );
  return match ?? CATEGORY_SCHEMAS.find(s => s.id === 'general')!;
}
