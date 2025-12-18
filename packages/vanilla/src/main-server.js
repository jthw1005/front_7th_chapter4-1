import items from "./mocks/items.json";
import { PRODUCT_ACTIONS } from "./stores/actionTypes.js";

// ============================================
// 1. ServerRouter 클래스
// ============================================
class ServerRouter {
  constructor() {
    this.routes = [];
  }

  /**
   * 라우트 추가
   * @param {string} path - 경로 패턴 (예: "/product/:id/")
   * @param {Function} handler - 페이지 컴포넌트
   */
  addRoute(path, handler) {
    // :param 형태를 정규식으로 변환
    const paramNames = [];
    const regexPath = path.replace(/:([^/]+)/g, (_, paramName) => {
      paramNames.push(paramName);
      return "([^/]+)";
    });

    this.routes.push({
      path,
      regex: new RegExp(`^${regexPath}$`),
      paramNames,
      handler,
    });
  }

  /**
   * URL과 매칭되는 라우트 찾기
   * @param {string} url - URL 경로
   * @returns {{ handler: Function, params: Object } | null}
   */
  findRoute(url) {
    // URL에서 경로만 추출 (쿼리스트링 제거)
    const pathname = url.split("?")[0];

    for (const route of this.routes) {
      const match = pathname.match(route.regex);
      if (match) {
        // params 객체 생성
        const params = {};
        route.paramNames.forEach((name, index) => {
          params[name] = match[index + 1];
        });

        return {
          handler: route.handler,
          params,
          path: route.path,
        };
      }
    }

    return null;
  }
}

// ============================================
// 2. Mock 데이터 함수들 (서버용)
// ============================================

/**
 * 카테고리 추출
 */
function getUniqueCategories() {
  const categories = {};

  items.forEach((item) => {
    const cat1 = item.category1;
    const cat2 = item.category2;

    if (!categories[cat1]) categories[cat1] = {};
    if (cat2 && !categories[cat1][cat2]) categories[cat1][cat2] = {};
  });

  return categories;
}

/**
 * 상품 필터링
 */
function filterProducts(products, query) {
  let filtered = [...products];

  // 검색어 필터링
  if (query.search) {
    const searchTerm = query.search.toLowerCase();
    filtered = filtered.filter(
      (item) => item.title.toLowerCase().includes(searchTerm) || item.brand.toLowerCase().includes(searchTerm),
    );
  }

  // 카테고리 필터링
  if (query.category1) {
    filtered = filtered.filter((item) => item.category1 === query.category1);
  }
  if (query.category2) {
    filtered = filtered.filter((item) => item.category2 === query.category2);
  }

  // 정렬
  if (query.sort) {
    switch (query.sort) {
      case "price_asc":
        filtered.sort((a, b) => parseInt(a.lprice) - parseInt(b.lprice));
        break;
      case "price_desc":
        filtered.sort((a, b) => parseInt(b.lprice) - parseInt(a.lprice));
        break;
      case "name_asc":
        filtered.sort((a, b) => a.title.localeCompare(b.title, "ko"));
        break;
      case "name_desc":
        filtered.sort((a, b) => b.title.localeCompare(a.title, "ko"));
        break;
      default:
        filtered.sort((a, b) => parseInt(a.lprice) - parseInt(b.lprice));
    }
  }

  return filtered;
}

/**
 * 상품 목록 조회 (서버용)
 */
export function mockGetProducts(options = {}) {
  const { page = 1, limit = 20, search = "", category1 = "", category2 = "", sort = "price_asc" } = options;

  const filteredProducts = filterProducts(items, {
    search,
    category1,
    category2,
    sort,
  });

  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

  return {
    products: paginatedProducts,
    pagination: {
      page,
      limit,
      total: filteredProducts.length,
      totalPages: Math.ceil(filteredProducts.length / limit),
      hasNext: endIndex < filteredProducts.length,
      hasPrev: page > 1,
    },
  };
}

/**
 * 카테고리 목록 조회 (서버용)
 */
export function mockGetCategories() {
  return getUniqueCategories();
}

/**
 * 상품 상세 조회 (서버용)
 */
export function mockGetProduct(productId) {
  const product = items.find((item) => item.productId === productId);

  if (!product) {
    return null;
  }

  return {
    ...product,
    description: `${product.title}에 대한 상세 설명입니다. ${product.brand} 브랜드의 우수한 품질을 자랑하는 상품으로, 고객 만족도가 높은 제품입니다.`,
    rating: 4,
    reviewCount: 500,
    stock: 50,
    images: [product.image, product.image.replace(".jpg", "_2.jpg"), product.image.replace(".jpg", "_3.jpg")],
  };
}

/**
 * 관련 상품 조회 (같은 카테고리)
 */
export function mockGetRelatedProducts(productId, limit = 20) {
  const product = items.find((item) => item.productId === productId);
  if (!product) return [];

  return items.filter((item) => item.productId !== productId && item.category1 === product.category1).slice(0, limit);
}

// ============================================
// 3. 서버용 Store 생성
// ============================================

function createServerStore(initialState) {
  let state = { ...initialState };

  return {
    getState: () => state,
    dispatch: (action) => {
      switch (action.type) {
        case PRODUCT_ACTIONS.SET_PRODUCTS:
          state = {
            ...state,
            products: action.payload.products,
            totalCount: action.payload.totalCount,
            loading: false,
            error: null,
          };
          break;
        case PRODUCT_ACTIONS.SET_CATEGORIES:
          state = {
            ...state,
            categories: action.payload,
          };
          break;
        case PRODUCT_ACTIONS.SET_CURRENT_PRODUCT:
          state = {
            ...state,
            currentProduct: action.payload,
            loading: false,
            error: null,
          };
          break;
        case PRODUCT_ACTIONS.SET_RELATED_PRODUCTS:
          state = {
            ...state,
            relatedProducts: action.payload,
          };
          break;
        case PRODUCT_ACTIONS.SETUP:
          state = { ...state, ...action.payload };
          break;
      }
    },
    subscribe: () => () => {}, // 서버에서는 구독 불필요
  };
}

// ============================================
// 4. 서버용 컴포넌트 임포트 및 렌더링
// ============================================

// 서버용 컴포넌트들을 직접 임포트 (withLifecycle 없이)
import { ProductList, SearchBar, CartModal, Footer, Toast, Logo } from "./components/index.js";

/**
 * 서버용 PageWrapper
 */
function ServerPageWrapper({ headerLeft, children }, stores) {
  const cart = stores.cartStore.getState();
  const { cartModal, toast } = stores.uiStore.getState();
  const cartSize = cart.items.length;

  const cartCount = `
    <span class="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
      ${cartSize > 99 ? "99+" : cartSize}
    </span>
  `;

  return `
    <div class="min-h-screen bg-gray-50">
      <header class="bg-white shadow-sm sticky top-0 z-40">
        <div class="max-w-md mx-auto px-4 py-4">
          <div class="flex items-center justify-between">
            ${headerLeft}
            <div class="flex items-center space-x-2">
              <button id="cart-icon-btn" class="relative p-2 text-gray-700 hover:text-gray-900 transition-colors">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M3 3h2l.4 2M7 13h10l4-8H5.4m2.6 8L6 2H3m4 11v6a1 1 0 001 1h1a1 1 0 001-1v-6M13 13v6a1 1 0 001 1h1a1 1 0 001-1v-6"/>
                </svg>
                ${cartSize > 0 ? cartCount : ""}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main class="max-w-md mx-auto px-4 py-4">
        ${children}
      </main>

      ${CartModal({ ...cart, isOpen: cartModal.isOpen })}

      ${Toast(toast)}

      ${Footer()}
    </div>
  `;
}

/**
 * 서버용 HomePage 렌더링
 */
function renderHomePage(stores, query) {
  const productState = stores.productStore.getState();
  const { search: searchQuery = "", limit = "20", sort = "", category1 = "", category2 = "" } = query;
  const { products, loading, error, totalCount, categories } = productState;
  const category = { category1, category2 };
  const hasMore = products.length < totalCount;

  return ServerPageWrapper(
    {
      headerLeft: `
        <h1 class="text-xl font-bold text-gray-900">
          <a href="/" data-link>쇼핑몰</a>
        </h1>
      `.trim(),
      children: `
        ${SearchBar({ searchQuery, limit, sort, category, categories })}

        <div class="mb-6">
          ${ProductList({
            products,
            loading,
            error,
            totalCount,
            hasMore,
          })}
        </div>
      `.trim(),
    },
    stores,
  );
}

/**
 * 서버용 ProductDetailPage 렌더링
 */
function renderProductDetailPage(stores) {
  const { currentProduct: product, relatedProducts = [], error, loading } = stores.productStore.getState();

  const loadingContent = `
    <div class="min-h-screen bg-gray-50 flex items-center justify-center">
      <div class="text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p class="text-gray-600">상품 정보를 불러오는 중...</p>
      </div>
    </div>
  `;

  const ErrorContent = ({ error }) => `
    <div class="min-h-screen bg-gray-50 flex items-center justify-center">
      <div class="text-center">
        <div class="text-red-500 mb-4">
          <svg class="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/>
          </svg>
        </div>
        <h1 class="text-xl font-bold text-gray-900 mb-2">상품을 찾을 수 없습니다</h1>
        <p class="text-gray-600 mb-4">${error || "요청하신 상품이 존재하지 않습니다."}</p>
        <button onclick="window.history.back()"
                class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 mr-2">
          이전 페이지
        </button>
        <a href="/" data-link class="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700">
          홈으로
        </a>
      </div>
    </div>
  `;

  function ProductDetail({ product, relatedProducts = [] }) {
    const {
      productId,
      title,
      image,
      lprice,
      brand,
      description = "",
      rating = 0,
      reviewCount = 0,
      stock = 100,
      category1,
      category2,
    } = product;

    const price = Number(lprice);

    const breadcrumbItems = [];
    if (category1) breadcrumbItems.push({ name: category1, category: "category1", value: category1 });
    if (category2) breadcrumbItems.push({ name: category2, category: "category2", value: category2 });

    return `
      ${
        breadcrumbItems.length > 0
          ? `
        <nav class="mb-4">
          <div class="flex items-center space-x-2 text-sm text-gray-600">
            <a href="/" data-link class="hover:text-blue-600 transition-colors">홈</a>
            ${breadcrumbItems
              .map(
                (item) => `
              <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
              </svg>
              <button class="breadcrumb-link" data-${item.category}="${item.value}">
                ${item.name}
              </button>
            `,
              )
              .join("")}
          </div>
        </nav>
      `
          : ""
      }

      <div class="bg-white rounded-lg shadow-sm mb-6">
        <div class="p-4">
          <div class="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-4">
            <img src="${image}"
                 alt="${title}"
                 class="w-full h-full object-cover product-detail-image">
          </div>

          <div>
            <p class="text-sm text-gray-600 mb-1">${brand}</p>
            <h1 class="text-xl font-bold text-gray-900 mb-3">${title}</h1>

            ${
              rating > 0
                ? `
              <div class="flex items-center mb-3">
                <div class="flex items-center">
                  ${Array(5)
                    .fill(0)
                    .map(
                      (_, i) => `
                    <svg class="w-4 h-4 ${i < rating ? "text-yellow-400" : "text-gray-300"}"
                         fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                    </svg>
                  `,
                    )
                    .join("")}
                </div>
                <span class="ml-2 text-sm text-gray-600">${rating}.0 (${reviewCount.toLocaleString()}개 리뷰)</span>
              </div>
            `
                : ""
            }

            <div class="mb-4">
              <span class="text-2xl font-bold text-blue-600">${price.toLocaleString()}원</span>
            </div>

            <div class="text-sm text-gray-600 mb-4">
              재고 ${stock.toLocaleString()}개
            </div>

            ${
              description
                ? `
              <div class="text-sm text-gray-700 leading-relaxed mb-6">
                ${description}
              </div>
            `
                : ""
            }
          </div>
        </div>

        <div class="border-t border-gray-200 p-4">
          <div class="flex items-center justify-between mb-4">
            <span class="text-sm font-medium text-gray-900">수량</span>
            <div class="flex items-center">
              <button id="quantity-decrease"
                      class="w-8 h-8 flex items-center justify-center border border-gray-300
                             rounded-l-md bg-gray-50 hover:bg-gray-100">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"/>
                </svg>
              </button>

              <input type="number"
                     id="quantity-input"
                     value="1"
                     min="1"
                     max="${stock}"
                     class="w-16 h-8 text-center text-sm border-t border-b border-gray-300
                            focus:ring-1 focus:ring-blue-500 focus:border-blue-500">

              <button id="quantity-increase"
                      class="w-8 h-8 flex items-center justify-center border border-gray-300
                             rounded-r-md bg-gray-50 hover:bg-gray-100">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                </svg>
              </button>
            </div>
          </div>

          <button id="add-to-cart-btn"
                  data-product-id="${productId}"
                  class="w-full bg-blue-600 text-white py-3 px-4 rounded-md
                         hover:bg-blue-700 transition-colors font-medium">
            장바구니 담기
          </button>
        </div>
      </div>

      <div class="mb-6">
        <button class="block w-full text-center bg-gray-100 text-gray-700 py-3 px-4 rounded-md
                  hover:bg-gray-200 transition-colors go-to-product-list">
          상품 목록으로 돌아가기
        </button>
      </div>

      ${
        relatedProducts.length > 0
          ? `
        <div class="bg-white rounded-lg shadow-sm">
          <div class="p-4 border-b border-gray-200">
            <h2 class="text-lg font-bold text-gray-900">관련 상품</h2>
            <p class="text-sm text-gray-600">같은 카테고리의 다른 상품들</p>
          </div>
          <div class="p-4">
            <div class="grid grid-cols-2 gap-3 responsive-grid">
              ${relatedProducts
                .slice(0, 20)
                .map(
                  (relatedProduct) => `
                <div class="bg-gray-50 rounded-lg p-3 related-product-card cursor-pointer"
                     data-product-id="${relatedProduct.productId}">
                  <div class="aspect-square bg-white rounded-md overflow-hidden mb-2">
                    <img src="${relatedProduct.image}"
                         alt="${relatedProduct.title}"
                         class="w-full h-full object-cover"
                         loading="lazy">
                  </div>
                  <h3 class="text-sm font-medium text-gray-900 mb-1 line-clamp-2">${relatedProduct.title}</h3>
                  <p class="text-sm font-bold text-blue-600">${Number(relatedProduct.lprice).toLocaleString()}원</p>
                </div>
              `,
                )
                .join("")}
            </div>
          </div>
        </div>
      `
          : ""
      }
    `;
  }

  const content = loading
    ? loadingContent
    : error && !product
      ? ErrorContent({ error })
      : ProductDetail({ product, relatedProducts });

  return ServerPageWrapper(
    {
      headerLeft: `
        <div class="flex items-center space-x-3">
          <button onclick="window.history.back()"
                  class="p-2 text-gray-700 hover:text-gray-900 transition-colors">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <h1 class="text-lg font-bold text-gray-900">상품 상세</h1>
        </div>
      `.trim(),
      children: content,
    },
    stores,
  );
}

/**
 * 서버용 NotFoundPage 렌더링
 */
function renderNotFoundPage(stores) {
  return ServerPageWrapper(
    {
      headerLeft: Logo(),
      children: `
        <div class="text-center my-4 py-20 shadow-md p-6 bg-white rounded-lg">
          <svg viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="blueGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#4285f4;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#1a73e8;stop-opacity:1" />
              </linearGradient>
              <filter id="softShadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="2" stdDeviation="8" flood-color="#000000" flood-opacity="0.1"/>
              </filter>
            </defs>

            <text x="160" y="85" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="48" font-weight="600" fill="url(#blueGradient)" text-anchor="middle">404</text>

            <circle cx="80" cy="60" r="3" fill="#e8f0fe" opacity="0.8"/>
            <circle cx="240" cy="60" r="3" fill="#e8f0fe" opacity="0.8"/>
            <circle cx="90" cy="45" r="2" fill="#4285f4" opacity="0.5"/>
            <circle cx="230" cy="45" r="2" fill="#4285f4" opacity="0.5"/>

            <text x="160" y="110" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="14" font-weight="400" fill="#5f6368" text-anchor="middle">페이지를 찾을 수 없습니다</text>

            <rect x="130" y="130" width="60" height="2" rx="1" fill="url(#blueGradient)" opacity="0.3"/>
          </svg>

          <a href="/" data-link class="inline-block px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">홈으로</a>
        </div>
      `.trim(),
    },
    stores,
  );
}

// ============================================
// 5. 메인 render 함수
// ============================================

/**
 * 서버 사이드 렌더링 메인 함수
 * @param {string} url - 요청 URL
 * @returns {Promise<{ html: string, head: string, initialData: Object }>}
 */
export async function render(url) {
  // URL 파싱
  const [pathname, queryString] = url.split("?");
  const query = {};
  if (queryString) {
    const params = new URLSearchParams(queryString);
    for (const [key, value] of params) {
      query[key] = value;
    }
  }

  // 서버용 Store 초기화
  const stores = {
    productStore: createServerStore({
      products: [],
      totalCount: 0,
      currentProduct: null,
      relatedProducts: [],
      loading: false,
      error: null,
      status: "idle",
      categories: {},
    }),
    cartStore: createServerStore({
      items: [],
      selectedAll: false,
    }),
    uiStore: createServerStore({
      cartModal: { isOpen: false },
      globalLoading: false,
      toast: { isVisible: false, message: "", type: "info" },
    }),
  };

  // 라우터 설정
  const router = new ServerRouter();
  router.addRoute("/", "home");
  router.addRoute("/product/:id/", "product");
  router.addRoute("/404", "notfound");

  // 라우트 매칭
  const route = router.findRoute(pathname);
  const routePath = route?.path || "notfound";
  const params = route?.params || {};

  // 데이터 프리페칭
  let initialData = {};

  if (routePath === "/") {
    // 홈페이지: 상품 목록 + 카테고리
    const limit = parseInt(query.limit) || 20;
    const page = parseInt(query.page) || 1;

    const productsData = mockGetProducts({
      page,
      limit,
      search: query.search || "",
      category1: query.category1 || "",
      category2: query.category2 || "",
      sort: query.sort || "price_asc",
    });
    const categories = mockGetCategories();

    stores.productStore.dispatch({
      type: PRODUCT_ACTIONS.SETUP,
      payload: {
        products: productsData.products,
        totalCount: productsData.pagination.total,
        categories,
        loading: false,
        error: null,
      },
    });

    initialData = {
      products: productsData.products,
      totalCount: productsData.pagination.total,
      categories,
    };
  } else if (routePath === "/product/:id/") {
    // 상품 상세 페이지
    const product = mockGetProduct(params.id);
    const relatedProducts = mockGetRelatedProducts(params.id);

    if (product) {
      stores.productStore.dispatch({
        type: PRODUCT_ACTIONS.SET_CURRENT_PRODUCT,
        payload: product,
      });
      stores.productStore.dispatch({
        type: PRODUCT_ACTIONS.SET_RELATED_PRODUCTS,
        payload: relatedProducts,
      });

      initialData = {
        currentProduct: product,
        relatedProducts,
      };
    } else {
      stores.productStore.dispatch({
        type: PRODUCT_ACTIONS.SET_ERROR,
        payload: "상품을 찾을 수 없습니다.",
      });
    }
  }

  // HTML 렌더링
  let html = "";

  if (routePath === "/") {
    html = renderHomePage(stores, query);
  } else if (routePath === "/product/:id/") {
    html = renderProductDetailPage(stores);
  } else {
    html = renderNotFoundPage(stores);
  }

  // SEO Head 태그 생성
  let head = "";

  if (routePath === "/") {
    head = `
      <title>쇼핑몰 - 상품 목록</title>
      <meta name="description" content="다양한 상품을 만나보세요">
    `;
  } else if (routePath === "/product/:id/") {
    const product = stores.productStore.getState().currentProduct;
    if (product) {
      head = `
        <title>${product.title} - 쇼핑몰</title>
        <meta name="description" content="${product.brand} - ${Number(product.lprice).toLocaleString()}원">
      `;
    } else {
      head = `
        <title>상품을 찾을 수 없습니다 - 쇼핑몰</title>
      `;
    }
  } else {
    head = `
      <title>페이지를 찾을 수 없습니다 - 쇼핑몰</title>
    `;
  }

  return { html, head, initialData };
}
