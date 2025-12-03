from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import BasePermission, IsAuthenticated
from django.db.models import Min, F
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache

# Импорты из родительских модулей
from ..models import Order, Item, Product
from ..serializers import OrderSerializer, ProductSerializer, UserSimpleSerializer, ItemSerializer
from django.contrib.auth.models import User
from ..telegram_bot import send_telegram_notification
from ..ai_service import ask_gemini # <--- Функция летит сюда

# --- Permissions ---
class IsAdminOrCantDelete(BasePermission):
    def has_permission(self, request, view):
        if view.action == 'destroy':
            return request.user.is_superuser
        return True

# --- ViewSets ---
class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated, IsAdminOrCantDelete]

    def get_queryset(self):
        queryset = Order.objects.all()
        is_archived = self.request.query_params.get('is_archived')
        if is_archived == 'true':
            queryset = queryset.filter(items__is_archived=True)
        elif is_archived == 'false':
            queryset = queryset.filter(items__is_archived=False)
        
        queryset = queryset.annotate(earliest_deadline=Min('items__deadline'))
        return queryset.distinct().order_by(F('earliest_deadline').asc(nulls_last=True), '-created_at')

    def get_serializer_context(self):
        context = super().get_serializer_context() 
        context['show_archived'] = self.request.query_params.get('is_archived') == 'true'
        return context

    def perform_create(self, serializer):
        order = serializer.save()
        try:
            send_telegram_notification(order)
        except Exception as e:
            print(f"Ошибка Telegram: {e}")

    @action(detail=True, methods=['post'])
    def archive(self, request, pk=None):
        try:
            order = self.get_object()
            c = order.items.update(is_archived=True)
            return Response({'status': 'success', 'message': f'{c} товаров архивировано.'})
        except Exception as e:
            return Response({'status': 'error', 'message': str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def unarchive(self, request, pk=None):
        try:
            order = self.get_object()
            c = order.items.update(is_archived=False)
            return Response({'status': 'success', 'message': f'{c} товаров восстановлено.'})
        except Exception as e:
            return Response({'status': 'error', 'message': str(e)}, status=400)


class ItemViewSet(viewsets.ModelViewSet):
    queryset = Item.objects.all()
    serializer_class = ItemSerializer
    permission_classes = [IsAuthenticated, IsAdminOrCantDelete]


class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Product.objects.all().order_by('name')
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None 
    
    @method_decorator(never_cache)
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)


class UserViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = User.objects.filter(is_active=True).order_by('first_name')
    serializer_class = UserSimpleSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None
    

# --- AI Chat View ---
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def chat_with_ai(request):
    question = request.data.get('message', '')
    if not question:
        return Response({'error': 'Пустой вопрос'}, status=400)
    
    # Здесь вызывается ai_service.py. Если там старая модель, будет ошибка 404.
    answer = ask_gemini(question)
    
    return Response({'answer': answer})