export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers);
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const showError = (error) => {
    let message = document.querySelector(".js-app-error");
    if (!message) {
      message = document.createElement("p");
      message.className = "app-error-message js-app-error";
      message.setAttribute("role", "alert");
      const header = document.querySelector(".amazon-header, .checkout-header");
      if (header) {
        header.insertAdjacentElement("afterend", message);
      } else {
        document.body.prepend(message);
      }
    }
    message.textContent = error.message;
    message.hidden = false;
  };

  let response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers,
      credentials: "same-origin",
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
  } catch (error) {
    const requestError = new Error("Could not reach the storefront server. Check that it is running.", {
      cause: error
    });
    showError(requestError);
    throw requestError;
  }

  let result;
  try {
    result = response.status === 204 ? undefined : await response.json();
  } catch (error) {
    const responseError = new Error("The storefront server returned an invalid response.", {
      cause: error
    });
    showError(responseError);
    throw responseError;
  }
  if (!response.ok) {
    const requestError = new Error(
      result?.error?.message || `Request failed with status ${response.status}.`
    );
    showError(requestError);
    throw requestError;
  }
  return result;
}
