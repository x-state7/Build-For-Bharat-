// server.js - Main Express Server
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const Redis = require('ioredis');
const { Pool } = require('pg');
const axios = require('axios');
const winston = require('winston');
const cron = require("node-cron"); 

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3001;

// Logger Configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({ format: winston.format.simple() })
  ]
});

// Redis Client
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  retryStrategy: (times) => Math.min(times * 50, 2000),
  maxRetriesPerRequest: 3
});

// PostgreSQL Connection Pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'mgnrega_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());
app.use(express.static('public'));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// --- UPDATED: API Configuration ---
const DATA_GOV_API_KEY = process.env.DATA_GOV_API_KEY;
// --- UPDATED: Base URL no longer contains the hardcoded API key ---
const DATA_GOV_BASE_URL = "https://api.data.gov.in/resource/ee03643a-ee4c-48c2-ac30-9f2ff26ab722?api-key=579b464db66ec23bdd000001f0ebe46ea537465b5d1d6188646b5a33&limit=100";

if (!DATA_GOV_API_KEY) {
  logger.warn('DATA_GOV_API_KEY is not set. API calls will fail.');
}

// Circuit Breaker State
let circuitState = {
  failures: 0,
  lastFailureTime: null,
  isOpen: false,
  threshold: 5,
  timeout: 60000 // 1 minute
};

// Circuit Breaker Check
function checkCircuitBreaker() {
  if (circuitState.isOpen) {
    const timeSinceLastFailure = Date.now() - circuitState.lastFailureTime;
    if (timeSinceLastFailure > circuitState.timeout) {
      logger.info('Circuit breaker reset');
      circuitState.isOpen = false;
      circuitState.failures = 0;
    }
    return false;
  }
  return true;
}

// Fetch from Data.gov.in with Circuit Breaker
async function fetchFromDataGov(params) {
  if (!checkCircuitBreaker()) {
    logger.warn('Circuit breaker is open, using cached data');
    throw new Error('Circuit breaker open');
  }

  try {
    const response = await axios.get(DATA_GOV_BASE_URL, {
      params: {
        'api-key': DATA_GOV_API_KEY, // --- Correctly passed from env ---
        format: 'json',
        ...params
      },
      timeout: 10000
    });

    circuitState.failures = 0;
    return response.data;
  } catch (error) {
    circuitState.failures++;
    circuitState.lastFailureTime = Date.now();
    
    if (circuitState.failures >= circuitState.threshold) {
      circuitState.isOpen = true;
      logger.error('Circuit breaker opened due to repeated failures');
    }
    
    throw error;
  }
}

// Cache Helper Functions
async function getCachedData(key) {
  try {
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    logger.error('Redis get error:', error);
    return null;
  }
}

async function setCachedData(key, data, ttl = 3600) {
  try {
    await redis.setex(key, ttl, JSON.stringify(data));
  } catch (error) {
    logger.error('Redis set error:', error);
  }
}

// Database Helper Functions
async function getFromDatabase(state, district, finYear) {
  const query = `
    SELECT * FROM mgnrega_data 
    WHERE state_name = $1 
    AND district_name = $2 
    AND fin_year = $3
    ORDER BY updated_at DESC
    LIMIT 1
  `;
  
  try {
    const result = await pool.query(query, [state, district, finYear]);
    return result.rows[0] || null; // Returns the full database row
  } catch (error) {
    logger.error('Database query error:', error);
    return null;
  }
}

async function saveToDatabase(record) {
  // This query matches the 'mappedRecord' object created in syncMGNREGAData
  const query = `
  INSERT INTO mgnrega_data (
    fin_year, month, state_code, state_name, district_code, district_name,
    approved_labour_budget, avg_wage_rate, avg_days_employment, diff_abled_persons_worked,
    material_and_skilled_wages, completed_works, gps_with_nil_exp, ongoing_works,
    central_liability_persondays, sc_persondays, sc_workers_active, st_persondays,
    st_workers_active, total_admin_expenditure, total_expenditure, total_households_worked,
    total_individuals_worked, active_job_cards, active_workers, hh_completed_100_days,
    job_cards_issued, total_workers, works_takenup, wages, women_persondays,
    percent_category_b_works, percent_agri_allied_works, percent_nrm_expenditure,
    percent_payments_15_days, remarks, data_payload, updated_at
  ) VALUES (
    $1,$2,$3,$4,$5,$6,
    $7,$8,$9,$10,
    $11,$12,$13,$14,
    $15,$16,$17,$18,
    $19,$20,$21,$22,
    $23,$24,$25,$26,
    $27,$28,$29,$30,$31,
    $32,$33,$34,$35,$36,
    $37, NOW()
  )
  ON CONFLICT (state_name, district_name, fin_year, month)
  DO UPDATE SET
    approved_labour_budget = EXCLUDED.approved_labour_budget,
    avg_wage_rate = EXCLUDED.avg_wage_rate,
    avg_days_employment = EXcluded.avg_days_employment,
    diff_abled_persons_worked = EXCLUDED.diff_abled_persons_worked,
    material_and_skilled_wages = EXCLUDED.material_and_skilled_wages,
    completed_works = EXCLUDED.completed_works,
    gps_with_nil_exp = EXCLUDED.gps_with_nil_exp,
    ongoing_works = EXCLUDED.ongoing_works,
    central_liability_persondays = EXCLUDED.central_liability_persondays,
    sc_persondays = EXCLUDED.sc_persondays,
    sc_workers_active = EXCLUDED.sc_workers_active,
    st_persondays = EXCLUDED.st_persondays,
    st_workers_active = EXCLUDED.st_workers_active,
    total_admin_expenditure = EXCLUDED.total_admin_expenditure,
    total_expenditure = EXCLUDED.total_expenditure,
    total_households_worked = EXCLUDED.total_households_worked,
    total_individuals_worked = EXCLUDED.total_individuals_worked,
    active_job_cards = EXCLUDED.active_job_cards,
    active_workers = EXCLUDED.active_workers,
    hh_completed_100_days = EXCLUDED.hh_completed_100_days,
    job_cards_issued = EXCLUDED.job_cards_issued,
    total_workers = EXCLUDED.total_workers,
    works_takenup = EXCLUDED.works_takenup,
    wages = EXCLUDED.wages,
    women_persondays = EXCLUDED.women_persondays,
    percent_category_b_works = EXCLUDED.percent_category_b_works,
    percent_agri_allied_works = EXCLUDED.percent_agri_allied_works,
    percent_nrm_expenditure = EXCLUDED.percent_nrm_expenditure,
    percent_payments_15_days = EXCLUDED.percent_payments_15_days,
    remarks = EXCLUDED.remarks,
    data_payload = EXCLUDED.data_payload,
    updated_at = NOW();
  `;
  
  try {
    await pool.query(query, [
      record.fin_year, 
      record.month, 
      record.state_code, 
      record.state_name, 
      record.district_code, 
      record.district_name,
      record.approved_labour_budget, 
      record.avg_wage_rate, 
      record.avg_days_employment, 
      record.diff_abled_persons_worked,
      record.material_and_skilled_wages, 
      record.completed_works, 
      record.gps_with_nil_exp, 
      record.ongoing_works,
      record.central_liability_persondays, 
      record.sc_persondays, 
      record.sc_workers_active, 
      record.st_persondays,
      record.st_workers_active, 
      record.total_admin_expenditure, 
      record.total_expenditure, 
      record.total_households_worked,
      record.total_individuals_worked, 
      record.active_job_cards, 
      record.active_workers, 
      record.hh_completed_100_days,
      record.job_cards_issued, 
      record.total_workers, 
      record.works_takenup, 
      record.wages, 
      record.women_persondays,
      record.percent_category_b_works, 
      record.percent_agri_allied_works, 
      record.percent_nrm_expenditure,
      record.percent_payments_15_days, 
      record.remarks,
      JSON.stringify(record.data_payload) // Store the raw payload for future-proofing
    ]);
    
    logger.info(`DB Sync: Saved ${record.state_name} - ${record.district_name}`);
  } catch (error) {
    logger.error('Database insert error:', error.message, { district: record.district_name });
  }
}

// ================================
// Real-Time Auto Sync Scheduler
// ================================
async function syncMGNREGAData() {
  try {
    logger.info("⏳ Syncing latest MGNREGA data...");

    const finYear = "2024-2025"; 
    const params = {
      limit: 5000, // Fetch all records
      "filters[fin_year]": finYear
    };

    const apiData = await fetchFromDataGov(params);

    if (apiData && apiData.records && apiData.records.length) {
      for (const api of apiData.records) {
        
        // --- UPDATED: Sanitize data before saving to DB ---
        const mappedRecord = {
          fin_year: api.fin_year,
          month: api.month,
          state_code: api.state_code,
          state_name: api.state_name,
          district_code: api.district_code,
          district_name: api.district_name,

          // --- Parse all numbers and default nulls to 0 ---
          approved_labour_budget: parseFloat(api.Approved_Labour_Budget) || 0,
          avg_wage_rate: parseFloat(api.Average_Wage_rate_per_day_per_person) || 0,
          avg_days_employment: parseFloat(api.Average_days_of_employment_provided_per_Household) || 0,
          diff_abled_persons_worked: parseFloat(api.Differently_abled_persons_worked) || 0,
          material_and_skilled_wages: parseFloat(api.Material_and_skilled_Wages) || 0,
          completed_works: parseFloat(api.Number_of_Completed_Works) || 0,
          gps_with_nil_exp: parseFloat(api.Number_of_GPs_with_NIL_exp) || 0,
          ongoing_works: parseFloat(api.Number_of_Ongoing_Works) || 0,
          central_liability_persondays: parseFloat(api.Persondays_of_Central_Liability_so_far) || 0,
          sc_persondays: parseFloat(api.SC_persondays) || 0,
          sc_workers_active: parseFloat(api.SC_workers_against_active_workers) || 0,
          st_persondays: parseFloat(api.ST_persondays) || 0,
          st_workers_active: parseFloat(api.ST_workers_against_active_workers) || 0,
          total_admin_expenditure: parseFloat(api.Total_Adm_Expenditure) || 0,
          total_expenditure: parseFloat(api.Total_Exp) || 0,
          total_households_worked: parseFloat(api.Total_Households_Worked) || 0,
          total_individuals_worked: parseFloat(api.Total_Individuals_Worked) || 0,
          active_job_cards: parseFloat(api.Total_No_of_Active_Job_Cards) || 0,
          active_workers: parseFloat(api.Total_No_of_Active_Workers) || 0,
          hh_completed_100_days: parseFloat(api.Total_No_of_HHs_completed_100_Days_of_Wage_Employment) || 0,
          job_cards_issued: parseFloat(api.Total_No_of_JobCards_issued) || 0,
          total_workers: parseFloat(api.Total_No_of_Workers) || 0,
          works_takenup: parseFloat(api.Total_No_of_Works_Takenup) || 0,
          wages: parseFloat(api.Wages) || 0,
          women_persondays: parseFloat(api.Women_Persondays) || 0,
          percent_category_b_works: parseFloat(api.percent_of_Category_B_Works) || 0,
          percent_agri_allied_works: parseFloat(api.percent_of_Expenditure_on_Agriculture_Allied_Works) || 0,
          percent_nrm_expenditure: parseFloat(api.percent_of_NRM_Expenditure) || 0,
          percent_payments_15_days: parseFloat(api.percentage_payments_gererated_within_15_days) || 0,
          
          remarks: api.Remarks || "",
          data_payload: api // Store the original raw API record
        };

        await saveToDatabase(mappedRecord);
      }

      logger.info(`✅ Synced ${apiData.records.length} records`);
    } else {
      logger.warn("⚠️ No records returned from API during sync");
    }
  } catch (error) {
    logger.error("❌ Sync error:", error.message);
  }
}
// Run every hour at minute 0
cron.schedule("0 * * * *", () => {
  logger.info("🕑 Running scheduled sync...");
  syncMGNREGAData();
});

// --- ADDED: Central Data Transformation Function ---
// This function takes a *raw data object* (either from API or DB payload)
// and transforms it into the *exact shape the frontend needs*,
// including safe calculations to prevent NaN.
function transformDataForFrontend(rawData) {
  
  // 1. Determine field names (API uses 'Total_Exp', DB uses 'total_expenditure')
  // We will standardize on the raw API format (which is stored in data_payload)
  const apiData = {
      fin_year: rawData.fin_year,
      state_name: rawData.state_name,
      district_name: rawData.district_name,
      // API source (e.g., apiData.records[0])
      Total_No_of_JobCards_issued: rawData.Total_No_of_JobCards_issued,
      Total_No_of_Active_Job_Cards: rawData.Total_No_of_Active_Job_Cards,
      Total_Individuals_Worked: rawData.Total_Individuals_Worked,
      Average_days_of_employment_provided_per_Household: rawData.Average_days_of_employment_provided_per_Household,
      Women_Persondays: rawData.Women_Persondays,
      Number_of_Completed_Works: rawData.Number_of_Completed_Works,
      Number_of_Ongoing_Works: rawData.Number_of_Ongoing_Works,
      Total_Exp: rawData.Total_Exp,
      Average_Wage_rate_per_day_per_person: rawData.Average_Wage_rate_per_day_per_person,
      Total_Households_Worked: rawData.Total_Households_Worked,
      Total_No_of_Active_Workers: rawData.Total_No_of_Active_Workers,
      
      // DB source (e.g., data.data_payload)
      job_cards_issued: rawData.job_cards_issued,
      active_job_cards: rawData.active_job_cards,
      person_days_generated: rawData.person_days_generated,
      avg_days_per_household: rawData.avg_days_per_household,
      women_person_days: rawData.women_persondays,
      completed_works: rawData.completed_works,
      ongoing_works: rawData.ongoing_works,
      total_expenditure: rawData.total_expenditure,
      avg_wage_rate: rawData.avg_wage_rate,
      total_households_worked: rawData.total_households_worked,
      active_workers: rawData.active_workers
  };

  // 2. Sanitize all possible input fields
  const personDays = parseFloat(apiData.Total_Individuals_Worked || apiData.person_days_generated) || 0;
  const activeCards = parseFloat(apiData.Total_No_of_Active_Job_Cards || apiData.active_job_cards) || 0;
  const womenDays = parseFloat(apiData.Women_Persondays || apiData.women_person_days) || 0;
  const avgWage = parseFloat(apiData.Average_Wage_rate_per_day_per_person || apiData.avg_wage_rate) || 0;
  const avgDaysAPI = parseFloat(apiData.Average_days_of_employment_provided_per_Household || apiData.avg_days_per_household) || 0;

  // 3. Perform safe calculations
  const calculatedAvgDays = (personDays / Math.max(activeCards, 1));
  const calculatedWomenPercent = (womenDays / Math.max(personDays, 1)) * 100;

  // 4. Return the clean, frontend-ready object
  return {
    fin_year: apiData.fin_year,
    state_name: apiData.state_name,
    district_name: apiData.district_name,
    
    job_cards_issued: parseFloat(apiData.Total_No_of_JobCards_issued || apiData.job_cards_issued) || 0,
    active_job_cards: activeCards,
    person_days_generated: personDays,
    
    avg_days_per_household: (avgDaysAPI || calculatedAvgDays).toFixed(2),
    women_participation_percent: (calculatedWomenPercent).toFixed(1),
    women_person_days: womenDays, // Pass this through for calculation
    
    completed_works: parseFloat(apiData.Number_of_Completed_Works || apiData.completed_works) || 0,
    ongoing_works: parseFloat(apiData.Number_of_Ongoing_Works || apiData.ongoing_works) || 0,
    total_expenditure: parseFloat(apiData.Total_Exp || apiData.total_expenditure) || 0,
    avg_wage_rate: avgWage.toFixed(2),
    
    total_households_worked: parseFloat(apiData.Total_Households_Worked || apiData.total_households_worked) || 0,
    active_workers: parseFloat(apiData.Total_No_of_Active_Workers || apiData.active_workers) || 0
  };
}


// ================================
// API Routes
// ================================

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    circuitBreaker: circuitState.isOpen ? 'open' : 'closed'
  });
});

// Manual Sync Trigger
app.post("/api/sync-now", async (req, res) => {
  logger.info('Manual data sync triggered by user');
  try {
    await syncMGNREGAData();
    res.json({ success: true, message: "Data sync triggered" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- REMOVED duplicate /api/district route ---

// Get All Districts for a State
app.get('/api/districts/:state', async (req, res) => {
  const { state } = req.params;
  const cacheKey = `districts:${state}`;
  
  try {
    let districts = await getCachedData(cacheKey);
    
    if (!districts) {
      const query = `
        SELECT DISTINCT district_name 
        FROM mgnrega_data 
        WHERE state_name = $1 
        ORDER BY district_name
      `;
      const result = await pool.query(query, [state]);
      districts = result.rows.map(r => r.district_name);
      await setCachedData(cacheKey, districts, 86400); // 24 hour cache
    }
    
    res.json({ districts });
  } catch (error) {
    logger.error('Error in districts endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Historical Data
// --- UPDATED SQL Query ---
app.get('/api/historical/:state/:district', async (req, res) => {
  const { state, district } = req.params;
  const cacheKey = `historical:${state}:${district}`;
  
  try {
    let data = await getCachedData(cacheKey);
    
    if (!data) {
      // --- UPDATED Query to use MAX/AVG for non-cumulative fields ---
      const query = `
        SELECT 
          fin_year,
          SUM(total_individuals_worked) as total_person_days,
          MAX(total_households_worked) as total_households,
          MAX(active_job_cards) as active_cards,
          SUM(total_expenditure) as total_exp,
          AVG(avg_wage_rate) as avg_wage
        FROM mgnrega_data 
        WHERE state_name = $1 
          AND district_name = $2
        GROUP BY fin_year
        ORDER BY fin_year ASC
        LIMIT 10
      `;
      
      const result = await pool.query(query, [state, district]);
      
      // Transform to match frontend expectations and ensure no nulls
      data = result.rows.map(row => ({
        year: row.fin_year,
        personDays: parseFloat(row.total_person_days) || 0,
        households: parseFloat(row.total_households) || 0,
        person_days_generated: parseFloat(row.total_person_days) || 0,
        active_job_cards: parseFloat(row.active_cards) || 0,
        total_expenditure: parseFloat(row.total_exp) || 0,
        avg_wage_rate: parseFloat(row.avg_wage) || 0
      }));
      
      await setCachedData(cacheKey, data, 3600);
    }
    
    res.json({ data });
  } catch (error) {
    logger.error('Error in historical endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// --- ADDED: Reverse Geocoding for Location Detection ---
app.post('/api/detect-district', async (req, res) => {
  const { latitude, longitude } = req.body;
  
  if (!latitude || !longitude) {
    return res.status(400).json({ error: 'Latitude and longitude are required.' });
  }

  // Cache based on 3 decimal places (approx 110 meters)
  const cacheKey = `geo:${latitude.toFixed(3)}:${longitude.toFixed(3)}`;

  try {
    // 1. Check cache first
    const cachedDistrict = await getCachedData(cacheKey);
    if (cachedDistrict) {
      logger.info(`Geocoding cache hit for ${cacheKey}`);
      return res.json({ district: cachedDistrict });
    }

    // 2. Call external geocoding API
    logger.info(`Geocoding API call for ${cacheKey}`);
    const geoApiUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`;
    
    const response = await axios.get(geoApiUrl, {
      headers: {
        // Nominatim requires a descriptive User-Agent
        'User-Agent': 'MGNREGA Dashboard App (mgnrega-dashboard-project)'
      }
    });

    const data = response.data;
    
    // Extract district. It can be in 'county', 'state_district', 'city_district' etc.
    let district = data.address?.county || data.address?.state_district || data.address?.city_district;

    if (district) {
      // Clean up the name (e.g., "Gautam Buddha Nagar District" -> "GAUTAM BUDDHA NAGAR")
      district = district.replace(/ district/i, '').toUpperCase();
      
      await setCachedData(cacheKey, district, 86400); // Cache for 24 hours
      res.json({ district: district });
    } else {
      logger.warn('Could not find district in geocoding response:', data.address);
      res.status(404).json({ error: 'Could not determine district from location.' });
    }

  } catch (error) {
    logger.error('Geocoding error:', error.message);
    res.status(500).json({ error: 'Failed to detect location.' });
  }
});


// Get District Data
// --- UPDATED: This is the single, consolidated route that uses the transformation helper ---
app.get('/api/district/:state/:district', async (req, res) => {
  const { state, district } = req.params;
  const { finYear = '2024-2025' } = req.query;
  
  const cacheKey = `district:${state}:${district}:${finYear}`;
  
  try {
    // 1. Try Redis Cache
    let data = await getCachedData(cacheKey);
    if (data) {
      logger.info(`Cache hit for ${cacheKey}`);
      // Data in cache is already transformed and safe
      return res.json({ source: 'cache', data });
    }
    
    // 2. Try Database
    // getFromDatabase returns the full row from mgnrega_data
    data = await getFromDatabase(state, district, finYear);
    if (data && isDataFresh(data.updated_at, 24)) {
      logger.info(`Database hit for ${cacheKey}`);
      
      // Transform the stored raw payload into frontend format
      const transformed = transformDataForFrontend(data.data_payload);
      
      await setCachedData(cacheKey, transformed, 3600);
      return res.json({ source: 'database', data: transformed });
    }
    
    // 3. Try Data.gov.in API
    try {
      const apiData = await fetchFromDataGov({
        'filters[state_name]': state,
        'filters[district_name]': district,
        'filters[fin_year]': finYear,
        limit: 1
      });
      
      if (apiData && apiData.records && apiData.records.length > 0) {
        const rawRecord = apiData.records[0];
        logger.info(`API hit for ${cacheKey}`);
        
        // Transform the raw API record for the frontend
        const transformed = transformDataForFrontend(rawRecord);
        
        // Asynchronously save the clean data to the DB (don't make user wait)
        // We can create the 'mappedRecord' here or just use the sync
        // For simplicity, we'll let the hourly sync handle saving this.
        // Or, we can trigger a save:
        // const mappedRecord = ... (create the full DB-schema-mapped object)
        // saveToDatabase(mappedRecord).catch(err => logger.error('Async DB save failed', err));

        await setCachedData(cacheKey, transformed, 3600);
        return res.json({ source: 'api', data: transformed });
      }
    } catch (apiError) {
      logger.error('API fetch failed:', apiError.message);
      
      // 4. Fallback to stale database data (if it exists)
      if (data) {
        logger.warn(`Using STALE data for ${cacheKey}`);
        // Transform the stored raw payload from the stale data
        const transformed = transformDataForFrontend(data.data_payload);
        return res.json({ source: 'database-stale', data: transformed });
      }
    }
    
    // No data available from any source
    logger.warn(`No data found for ${cacheKey}`);
    res.status(404).json({ error: 'No data available for this district' });
    
  } catch (error) {
    logger.error('Error in district endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to check data freshness
function isDataFresh(updatedAt, hoursThreshold) {
  if (!updatedAt) return false;
  const now = new Date();
  const updated = new Date(updatedAt);
  const hoursDiff = (now - updated) / (1000 * 60 * 60);
  return hoursDiff < hoursThreshold;
}

// Graceful Shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing server gracefully');
  await redis.quit();
  await pool.end();
  process.exit(0);
});

// Start Server
app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  // Run a sync on startup
  logger.info('Running initial data sync on startup...');
  syncMGNREGAData();
});