from __future__ import annotations

from flask import Flask, jsonify
from werkzeug.exceptions import HTTPException
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from psycopg import errors as pg_errors

from .config import Config
from .db import init_app as init_db

jwt = JWTManager()


def create_app(config_object=Config):
    app = Flask(__name__)
    app.config.from_object(config_object)

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
    ):
        app.register_blueprint(bp, url_prefix="/api")

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
        return jsonify(message="File is larger than the 5 MB limit."), 413

    @app.errorhandler(pg_errors.UniqueViolation)
    def unique_violation(_error):
        return jsonify(message="A record with the same unique value already exists."), 409

    @app.errorhandler(pg_errors.CheckViolation)
    def check_violation(error):
        return jsonify(message="Submitted data violates a database validation rule.", detail=str(error)), 422

    @app.errorhandler(HTTPException)
    def http_error(error):
        return jsonify(message=error.description), error.code

    @app.errorhandler(Exception)
    def unhandled(error):
        app.logger.exception("Unhandled StayEd API error")
        payload = {"message": "The server encountered an unexpected error."}
        if app.debug:
            payload["detail"] = str(error)
        return jsonify(payload), 500

    return app
