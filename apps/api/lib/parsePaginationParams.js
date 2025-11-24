/**
 * Pagination Parameters Parser
 * 
 * Validates and parses pagination query parameters from Express requests.
 * Ensures safe defaults and validates limits/offsets.
 * 
 * @param {Object} req - Express request object
 * @param {Object} options - Optional configuration
 * @param {number} options.defaultLimit - Default limit (default: 20)
 * @param {number} options.maxLimit - Maximum allowed limit (default: 100)
 * @param {number} options.minLimit - Minimum allowed limit (default: 1)
 * @returns {Object} { limit, offset, hasMore }
 */

function parsePaginationParams(req, options = {}) {
  const {
    defaultLimit = 20,
    maxLimit = 100,
    minLimit = 1
  } = options;

  // Parse limit
  let limit = parseInt(req.query.limit, 10);
  if (isNaN(limit) || limit < minLimit) {
    limit = defaultLimit;
  }
  if (limit > maxLimit) {
    limit = maxLimit;
  }

  // Parse offset
  let offset = parseInt(req.query.offset, 10);
  if (isNaN(offset) || offset < 0) {
    offset = 0;
  }

  return {
    limit,
    offset,
    // hasMore will be calculated by the endpoint based on total count
  };
}

/**
 * Validate pagination parameters and throw error if invalid
 * @param {Object} req - Express request object
 * @throws {Error} If parameters are invalid
 */
function validatePaginationParams(req) {
  const limit = req.query.limit;
  const offset = req.query.offset;

  if (limit !== undefined) {
    const limitNum = parseInt(limit, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      throw new Error('Invalid limit: must be between 1 and 100');
    }
  }

  if (offset !== undefined) {
    const offsetNum = parseInt(offset, 10);
    if (isNaN(offsetNum) || offsetNum < 0) {
      throw new Error('Invalid offset: must be >= 0');
    }
  }
}

/**
 * Calculate pagination metadata
 * @param {number} total - Total number of items
 * @param {number} limit - Items per page
 * @param {number} offset - Current offset
 * @returns {Object} { total, limit, offset, hasMore, currentPage, totalPages }
 */
function calculatePaginationMeta(total, limit, offset) {
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);
  const hasMore = (offset + limit) < total;

  return {
    total,
    limit,
    offset,
    hasMore,
    currentPage,
    totalPages
  };
}

module.exports = {
  parsePaginationParams,
  validatePaginationParams,
  calculatePaginationMeta
};

