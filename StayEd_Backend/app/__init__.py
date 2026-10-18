from __future__ import annotations

from flask import Flask, jsonify
from werkzeug.exceptions import HTTPException
from werkzeug.middleware.proxy_fix import ProxyFix
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from psycopg import errors as pg_errors

from .config import Config
from .db import init_app as init_db

jwt = JWTManager()


def create_app(config_object=Config):
    app = Flask(__name__)
    app.config.from_object(config_object)

    trusted_proxy_count = app.config.get("TRUSTED_PROXY_COUNT", 0)
    if trusted_proxy_count:
        # Unwraps exactly that many hops of X-Forwarded-For/-Proto so
        # request.remote_addr (used by e.g. the public student-lookup rate
        # limiter) is the real visitor IP, not the proxy's. Only applied
        # when actually deployed behind that many trusted proxies -- see
        # TRUSTED_PROXY_COUNT's docstring in config.py for why this isn't
        # unconditional.
        app.wsgi_app = ProxyFix(
            app.wsgi_app, x_for=trusted_proxy_count, x_proto=trusted_proxy_count
        )

    CORS(
        app,
        resources={r"/api/*": {"origins": app.config["FRONTEND_ORIGINS"]}},
        supports_credentials=False,
    )
    jwt.init_app(app)
    init_db(app)

    from .routes.auth_routes import bp as auth_bp
    from .routes.user_routes import bp as user_bp
    from .routes.clc_routes import bp as clc_bp
    from .routes.class_routes import bp as class_bp
    from .routes.learner_routes import bp as learner_bp
    from .routes.dashboard_routes import bp as dashboard_bp
    from .routes.prediction_routes import bp as prediction_bp
    from .routes.intervention_routes import bp as intervention_bp
    from .routes.notification_routes import bp as notification_bp
    from .routes.admin_routes import bp as admin_bp
    from .routes.reports_routes import bp as reports_bp

    for bp in (
        auth_bp,
        user_bp,
        clc_bp,
        class_bp,
        learner_bp,
        dashboard_bp,
        prediction_bp,
        intervention_bp,
        notification_bp,
        admin_bp,
        reports_bp,
    ):
        app.register_blueprint(bp, url_prefix="/api")

    # Someone still on an admin-issued temporary password can do nothing but
    # pick their own (sql/38_must_change_password.sql). Checked once here
    # instead of in every route's decorator.
    password_change_allowed = {
        "/api/auth/set-initial-password",
        "/api/auth/me",
        "/api/auth/logout",
        "/api/auth/login",
        "/api/auth/forgot-password",
        "/api/auth/reset-password",
        "/api/health",
    }

    @app.before_request
    def require_initial_password_change():
        from flask import request
        from flask_jwt_extended import get_jwt, verify_jwt_in_request

        if request.method == "OPTIONS" or request.path in password_change_allowed:
            return None
        if not request.path.startswith("/api/"):
            return None
        try:
            verify_jwt_in_request(optional=True)
        except Exception:
            # Bad/expired token: let the route's own auth produce its usual
            # 401, or a public route ignore it.
            return None
        if get_jwt().get("must_change_password"):
            return jsonify({
                "message": "Please set a new password before continuing.",
                "code": "PASSWORD_CHANGE_REQUIRED",
            }), 403
        return None

    @app.get("/api/health")
    def health():
        from .db import fetch_one

        row = fetch_one("SELECT current_database() AS database, NOW() AS now")
        return {
            "status": "ok",
            "service": "StayEd API",
            "database": row["database"],
            "time": row["now"].isoformat(),
        }

    @app.errorhandler(413)
    def too_large(_error):
        return jsonify(message="This file is too big. Please use a file smaller than 5 MB."), 413

    @app.errorhandler(pg_errors.UniqueViolation)
    def unique_violation(_error):
        return jsonify(message="This already exists, so it was not saved again."), 409

    @app.errorhandler(pg_errors.CheckViolation)
    def check_violation(error):
        return jsonify(message="Some of the information entered is not allowed. Please check it and try again.", detail=str(error)), 422

    @app.errorhandler(HTTPException)
    def http_error(error):
        return jsonify(message=error.description), error.code

    @app.errorhandler(Exception)
    def unhandled(error):
        app.logger.exception("Unhandled StayEd API error")
        payload = {"message": "Something went wrong on our side. Please try again in a moment."}
        if app.debug:
            payload["detail"] = str(error)
        return jsonify(payload), 500

    return app
