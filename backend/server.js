// server.js - UP-Specific MGNREGA Server
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

// UTTAR PRADESH FILTER
const TARGET_STATE = "UTTAR PRADESH";

// Logger Configuration
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ]
});

// console logging in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}
// Redis Client
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true
});
redis.on('error', (err) => {
  logger.error('Redis connection error:', err);
});

redis.on('connect', () => {
  logger.info('Redis connected successfully');
});

// Connect to Redis
redis.connect().catch(err => {
  logger.error('Failed to connect to Redis:', err);
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
// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    logger.error('Database connection error:', err);
  } else {
    logger.info('Database connected successfully');
  }
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(compression());

// CORS configuration for production
const corsOptions = {
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/build')));
}

// Rate Limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// API Configuration
const DATA_GOV_API_KEY = process.env.DATA_GOV_API_KEY || "579b464db66ec23bdd000001f0ebe46ea537465b5d1d6188646b5a33";
const DATA_GOV_BASE_URL = "https://api.data.gov.in/resource/ee03643a-ee4c-48c2-ac30-9f2ff26ab722";

// Circuit Breaker State
let circuitState = {
  failures: 0,
  lastFailureTime: null,
  isOpen: false,
  threshold: 5,
  timeout: 60000
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

// Fetch from Data.gov.in with Circuit Breaker (UP ONLY)
async function fetchFromDataGov(params) {
  if (!checkCircuitBreaker()) {
    logger.warn('Circuit breaker is open, using cached data');
    throw new Error('Circuit breaker open');
  }

  try {
    // ALWAYS ADD UP FILTER
    const upParams = {
      'api-key': DATA_GOV_API_KEY,
      format: 'json',
      limit: 10000,
      'filters[state_name]': TARGET_STATE,
      ...params
    };

    const response = await axios.get(DATA_GOV_BASE_URL, {
      params: upParams,
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

// Database Helper Functions (UP ONLY)
async function getFromDatabase(district, finYear) {
  const query = `
    SELECT * FROM mgnrega_data 
    WHERE state_name = $1 
    AND district_name = $2 
    AND fin_year = $3
    ORDER BY updated_at DESC
    LIMIT 1
  `;
  
  try {
    const result = await pool.query(query, [TARGET_STATE, district, finYear]);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Database query error:', error);
    return null;
  }
}

async function saveToDatabase(record) {
  // ONLY SAVE UP DATA
  if (record.state_name !== TARGET_STATE) {
    logger.warn(`Rejecting non-UP data: ${record.state_name}`);
    return;
  }

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
    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
    $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,NOW()
  )
  ON CONFLICT (state_name, district_name, fin_year, month)
  DO UPDATE SET
    approved_labour_budget = EXCLUDED.approved_labour_budget,
    avg_wage_rate = EXCLUDED.avg_wage_rate,
    avg_days_employment = EXCLUDED.avg_days_employment,
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
      record.fin_year, record.month, record.state_code, record.state_name, 
      record.district_code, record.district_name, record.approved_labour_budget, 
      record.avg_wage_rate, record.avg_days_employment, record.diff_abled_persons_worked,
      record.material_and_skilled_wages, record.completed_works, record.gps_with_nil_exp, 
      record.ongoing_works, record.central_liability_persondays, record.sc_persondays, 
      record.sc_workers_active, record.st_persondays, record.st_workers_active, 
      record.total_admin_expenditure, record.total_expenditure, record.total_households_worked,
      record.total_individuals_worked, record.active_job_cards, record.active_workers, 
      record.hh_completed_100_days, record.job_cards_issued, record.total_workers, 
      record.works_takenup, record.wages, record.women_persondays,
      record.percent_category_b_works, record.percent_agri_allied_works, 
      record.percent_nrm_expenditure, record.percent_payments_15_days, record.remarks,
      JSON.stringify(record.data_payload)
    ]);
  } catch (error) {
    logger.error('Database insert error:', error.message);
  }
}

// Data Transformation Function
function transformDataForFrontend(rawData) {
  const apiData = rawData.data_payload || rawData;

  const activeCards = parseFloat(apiData.Total_No_of_Active_Job_Cards || apiData.active_job_cards) || 0;
  const avgDaysPerHH = parseFloat(apiData.Average_days_of_employment_provided_per_Household || apiData.avg_days_employment) || 0;
  const womenDays = parseFloat(apiData.Women_Persondays || apiData.women_persondays) || 0;
  const avgWage = parseFloat(apiData.Average_Wage_rate_per_day_per_person || apiData.avg_wage_rate) || 0;

  const personDays = activeCards * avgDaysPerHH;
  const womenPercent = personDays > 0 ? (womenDays / personDays) * 100 : 0;

  const wagesInLakhs = parseFloat(apiData.Wages || apiData.wages) || 0;
  const materialsInLakhs = parseFloat(apiData.Material_and_skilled_Wages || apiData.material_and_skilled_wages) || 0;
  const totalExpenditure = (wagesInLakhs + materialsInLakhs) * 100000;

  return {
    fin_year: apiData.fin_year,
    state_name: apiData.state_name,
    district_name: apiData.district_name,
    job_cards_issued: parseFloat(apiData.Total_No_of_JobCards_issued || apiData.job_cards_issued) || 0,
    active_job_cards: activeCards,
    person_days_generated: Math.round(personDays),
    avg_days_per_household: avgDaysPerHH.toFixed(2),
    women_participation_percent: womenPercent.toFixed(1),
    women_person_days: Math.round(womenDays),
    completed_works: parseFloat(apiData.Number_of_Completed_Works || apiData.completed_works) || 0,
    ongoing_works: parseFloat(apiData.Number_of_Ongoing_Works || apiData.ongoing_works) || 0,
    total_expenditure: Math.round(totalExpenditure),
    avg_wage_rate: avgWage.toFixed(2),
    total_households_worked: parseFloat(apiData.Total_Households_Worked || apiData.total_households_worked) || 0,
    active_workers: parseFloat(apiData.Total_No_of_Active_Workers || apiData.active_workers) || 0
  };
}

// Sync Function (UP ONLY)
async function syncMGNREGAData() {
  try {
    logger.info(`⏳ Starting MGNREGA data sync for ${TARGET_STATE}...`);
    
    const yearsToSync = ["2024-2025", "2023-2024", "2022-2023", "2021-2022"];
    let totalSynced = 0;

    for (const finYear of yearsToSync) {
      logger.info(`📅 Syncing ${TARGET_STATE} - Year: ${finYear}`);
      
      let offset = 0;
      let hasMore = true;
      
      while (hasMore) {
        const params = {
          limit: 1000,
          offset: offset,
          "filters[fin_year]": finYear
          // state filter already added in fetchFromDataGov
        };

        const apiData = await fetchFromDataGov(params);

        if (apiData && apiData.records && apiData.records.length > 0) {
          for (const api of apiData.records) {
            // Double check it's UP data
            if (api.state_name !== TARGET_STATE) continue;

            const mappedRecord = {
              fin_year: api.fin_year,
              month: api.month,
              state_code: api.state_code,
              state_name: api.state_name,
              district_code: api.district_code,
              district_name: api.district_name,
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
              data_payload: api
            };

            await saveToDatabase(mappedRecord);
            totalSynced++;
          }
          
          logger.info(`✅ Synced ${apiData.records.length} UP records (offset: ${offset})`);
          offset += 1000;
          
          if (apiData.records.length < 1000) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }
    }
    
    logger.info(`✅ UP Sync complete! Total records synced: ${totalSynced}`);
  } catch (error) {
    logger.error("❌ UP Sync error:", error.message);
  }
}

// Schedule hourly sync
cron.schedule("0 * * * *", () => {
  logger.info("🕑 Running scheduled UP sync...");
  syncMGNREGAData();
});

// API Routes

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    state: TARGET_STATE,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    circuitBreaker: circuitState.isOpen ? 'open' : 'closed',
    environment: process.env.NODE_ENV
  });
});
// Manual Sync
app.post("/api/sync-now", async (req, res) => {
  logger.info(`Manual UP sync triggered`);
  try {
    syncMGNREGAData();
    res.json({ success: true, message: `${TARGET_STATE} sync started in background` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get Districts (UP ONLY)
app.get('/api/districts', async (req, res) => {
  const cacheKey = `districts:${TARGET_STATE}`;
  
  try {
    let districts = await getCachedData(cacheKey);
    
    if (!districts) {
      const query = `
        SELECT DISTINCT district_name 
        FROM mgnrega_data 
        WHERE state_name = $1 
        ORDER BY district_name
      `;
      const result = await pool.query(query, [TARGET_STATE]);
      districts = result.rows.map(r => r.district_name);
      await setCachedData(cacheKey, districts, 86400);
    }
    
    res.json({ state: TARGET_STATE, districts });
  } catch (error) {
    logger.error('Error in districts endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Historical Data (UP ONLY)
app.get('/api/historical/:district', async (req, res) => {
  const { district } = req.params;
  const cacheKey = `historical:${TARGET_STATE}:${district}`;
  
  try {
    let data = await getCachedData(cacheKey);
    
    if (!data) {
      const query = `
        SELECT 
          fin_year,
          MAX(active_job_cards) as active_cards,
          MAX(avg_days_employment) as avg_days_per_hh,
          MAX(active_workers) as active_workers,
          SUM(women_persondays) as total_women_days,
          SUM(wages) as total_wages_lakhs,
          SUM(material_and_skilled_wages) as total_materials_lakhs,
          AVG(avg_wage_rate) as avg_wage,
          MAX(completed_works) as completed_works,
          MAX(ongoing_works) as ongoing_works
        FROM mgnrega_data 
        WHERE state_name = $1 AND district_name = $2
        GROUP BY fin_year
        ORDER BY fin_year DESC
        LIMIT 10
      `;
      
      const result = await pool.query(query, [TARGET_STATE, district]);
      
      data = result.rows.map(row => {
        const activeCards = parseFloat(row.active_cards) || 0;
        const avgDays = parseFloat(row.avg_days_per_hh) || 0;
        const personDays = activeCards * avgDays;
        const womenDays = parseFloat(row.total_women_days) || 0;
        const womenPercent = personDays > 0 ? (womenDays / personDays) * 100 : 0;
        const totalExp = (parseFloat(row.total_wages_lakhs) + parseFloat(row.total_materials_lakhs)) * 100000;
        
        return {
          year: row.fin_year,
          person_days_generated: Math.round(personDays),
          avg_days_per_household: parseFloat(avgDays).toFixed(1),
          active_job_cards: activeCards,
          active_workers: parseFloat(row.active_workers) || 0,
          women_participation_percent: womenPercent.toFixed(1),
          women_person_days: Math.round(womenDays),
          total_expenditure: Math.round(totalExp),
          avg_wage_rate: parseFloat(row.avg_wage) || 0,
          completed_works: parseFloat(row.completed_works) || 0,
          ongoing_works: parseFloat(row.ongoing_works) || 0,
          personDays: Math.round(personDays),
          households: activeCards
        };
      });
      
      await setCachedData(cacheKey, data, 3600);
    }
    
    res.json({ state: TARGET_STATE, data });
  } catch (error) {
    logger.error('Error in historical endpoint:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Get District Data (UP ONLY)
app.get('/api/district/:district', async (req, res) => {
  const { district } = req.params;
  const { finYear = '2024-2025' } = req.query;
  const cacheKey = `district:${TARGET_STATE}:${district}:${finYear}`;
  
  try {
    let data = await getCachedData(cacheKey);
    if (data) {
      return res.json({ source: 'cache', state: TARGET_STATE, data });
    }
    
    data = await getFromDatabase(district, finYear);
    if (data && isDataFresh(data.updated_at, 24)) {
      const transformed = transformDataForFrontend(data);
      await setCachedData(cacheKey, transformed, 3600);
      return res.json({ source: 'database', state: TARGET_STATE, data: transformed });
    }
    
    try {
      const apiData = await fetchFromDataGov({
        'filters[district_name]': district,
        'filters[fin_year]': finYear,
        limit: 1
      });
      
      if (apiData && apiData.records && apiData.records.length > 0) {
        const transformed = transformDataForFrontend(apiData.records[0]);
        await setCachedData(cacheKey, transformed, 3600);
        return res.json({ source: 'api', state: TARGET_STATE, data: transformed });
      }
    } catch (apiError) {
      if (data) {
        const transformed = transformDataForFrontend(data);
        return res.json({ source: 'database-stale', state: TARGET_STATE, data: transformed });
      }
    }
    
    res.status(404).json({ error: `No data available for ${district} in ${TARGET_STATE}` });
  } catch (error) {
    logger.error('Error in district endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Geocoding (UP ONLY)
app.post('/api/detect-district', async (req, res) => {
  const { latitude, longitude } = req.body;
  
  if (!latitude || !longitude) {
    return res.status(400).json({ error: 'Latitude and longitude required' });
  }

  const cacheKey = `geo:${latitude.toFixed(3)}:${longitude.toFixed(3)}`;

  try {
    const cached = await getCachedData(cacheKey);
    if (cached) {
      return res.json({ state: TARGET_STATE, district: cached });
    }

    const geoApiUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`;
    const response = await axios.get(geoApiUrl, {
      headers: { 'User-Agent': 'MGNREGA Dashboard App' }
    });

    const detectedState = response.data.address?.state;
    
    // Check if location is in UP
    if (!detectedState || !detectedState.toLowerCase().includes('uttar pradesh')) {
      return res.status(400).json({ 
        error: 'Location is not in Uttar Pradesh',
        detected_state: detectedState 
      });
    }

    let district = response.data.address?.county || response.data.address?.state_district;
    if (district) {
      district = district.replace(/ district/i, '').toUpperCase();
      await setCachedData(cacheKey, district, 86400);
      res.json({ state: TARGET_STATE, district });
    } else {
      res.status(404).json({ error: 'Could not determine district in UP' });
    }
  } catch (error) {
    logger.error('Geocoding error:', error);
    res.status(500).json({ error: 'Failed to detect location' });
  }
});

// Helper
function isDataFresh(updatedAt, hoursThreshold) {
  if (!updatedAt) return false;
  const hoursDiff = (new Date() - new Date(updatedAt)) / (1000 * 60 * 60);
  return hoursDiff < hoursThreshold;
}

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message
  });
});

// Graceful Shutdown
const gracefulShutdown = async () => {
  logger.info('Received shutdown signal, closing gracefully...');
  
  try {
    await redis.quit();
    await pool.end();
    process.exit(0);
  } catch (err) {
    logger.error('Error during shutdown:', err);
    process.exit(1);
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start Server
const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📍 Configured for: ${TARGET_STATE}`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV}`);
  logger.info('🔄 Starting initial UP data sync...');
  syncMGNREGAData();
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = server;