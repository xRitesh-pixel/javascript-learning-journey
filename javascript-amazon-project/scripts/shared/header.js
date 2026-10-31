import { getCart } from "../../data/cart.js";

export async function updateCartCount() {
  const { totals } = await getCart();
  const cartQuantity = totals.itemCount;
  document.querySelectorAll('.js-cart-quantity').forEach((element) => {
    element.textContent = cartQuantity;
  });
  document.querySelectorAll('.js-checkout-quantity').forEach((element) => {
    element.textContent = `${cartQuantity} ${cartQuantity === 1 ? 'item' : 'items'}`;
  });
}

export function setupSearch(onSearch) {
  const searchBar = document.querySelector('.js-search-bar');
  const searchButton = document.querySelector('.js-search-button');
  const search = () => {
    if (onSearch) {
      onSearch();
      return;
    }

    const searchTerm = searchBar.value.trim();
    window.location.href = `amazon.html?search=${encodeURIComponent(searchTerm)}`;
  };

  searchButton.addEventListener('click', search);
  searchBar.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      search();
    }
  });
}
