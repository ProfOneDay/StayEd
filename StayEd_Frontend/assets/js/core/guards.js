class Guards {
  static auth() {
    if (!Auth.validateSession()) {
      window.location.href = "../auth/login.html";
    }
  }

  static guest() {
    if (Auth.validateSession()) {
      Auth.redirectAfterLogin();
    }
  }

  static teacher() {
    this.auth();

    if (Auth.role() !== "teacher") {
      this.unauthorized();
    }
  }

  static admin() {
    this.auth();

    if (Auth.role() !== "admin") {
      this.unauthorized();
    }
  }

  static roles(...roles) {
    this.auth();

    if (!roles.includes(Auth.role())) {
      this.unauthorized();
    }
  }

  static unauthorized() {
    window.location.href = "../errors/403.html";
  }

  static notFound() {
    window.location.href = "../errors/404.html";
  }
}

window.Guards = Guards;

document.addEventListener(
  "DOMContentLoaded",

  () => {
    console.log(
      "%cStayEd Guards Ready",

      "color:#12355B;font-weight:bold;",
    );
  },
);
