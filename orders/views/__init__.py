from .api import OrderViewSet, ItemViewSet, ProductViewSet, UserViewSet, chat_with_ai
from .web import index, logout_view, profile_view, archive_page_view, statistics_page
from .settings import (
    settings_page_view, notification_settings_view,
    user_list_view, user_create_view, user_update_view, user_delete_view,
    company_settings_view, settings_integrations_view,
    product_list_view, product_create_view, product_update_view, product_delete_view
)
from .stats import statistics_data_view
from .integrations import sync_to_google_sheets