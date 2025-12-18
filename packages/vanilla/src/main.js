import { registerGlobalEvents } from "./utils";
import { initRender } from "./render";
import { registerAllEvents } from "./events";
import { loadCartFromStorage } from "./services";
import { router } from "./router";
import { BASE_URL } from "./constants.js";
import { productStore, PRODUCT_ACTIONS } from "./stores";

const enableMocking = () =>
  import("./mocks/browser.js").then(({ worker }) =>
    worker.start({
      serviceWorker: {
        url: `${BASE_URL}mockServiceWorker.js`,
      },
      onUnhandledRequest: "bypass",
    }),
  );

/**
 * 서버에서 주입된 초기 데이터로 클라이언트 Store 복원 (Hydration)
 */
function hydrateInitialData() {
  if (typeof window !== "undefined" && window.__INITIAL_DATA__) {
    const data = window.__INITIAL_DATA__;

    console.log("__INITIAL_DATA__", data);

    // 홈페이지 데이터 복원 (상품 목록, 카테고리)
    if (data.products) {
      productStore.dispatch({
        type: PRODUCT_ACTIONS.SETUP,
        payload: {
          products: data.products,
          totalCount: data.totalCount,
          categories: data.categories || {},
          loading: false,
          error: null,
        },
      });
    }

    // 상품 상세 페이지 데이터 복원
    if (data.currentProduct) {
      productStore.dispatch({
        type: PRODUCT_ACTIONS.SET_CURRENT_PRODUCT,
        payload: data.currentProduct,
      });

      if (data.relatedProducts) {
        productStore.dispatch({
          type: PRODUCT_ACTIONS.SET_RELATED_PRODUCTS,
          payload: data.relatedProducts,
        });
      }
    }

    // 사용 후 삭제 (메모리 정리 및 중복 hydration 방지)
    delete window.__INITIAL_DATA__;
  }
}

function main() {
  // 서버 데이터로 Store 초기화 (Hydration)
  hydrateInitialData();

  registerAllEvents();
  registerGlobalEvents();
  loadCartFromStorage();
  initRender();
  router.start();
}

if (import.meta.env.MODE !== "test") {
  enableMocking().then(main);
} else {
  main();
}
