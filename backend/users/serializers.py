from rest_framework import serializers
from .models import User


class RegisterSerializer(serializers.ModelSerializer):

    password = serializers.CharField(
        write_only=True,
        min_length=8
    )

    class Meta:
        model = User
        fields = [
            "username",
            "email",
            "password",
            "role"
            
        ]
    def validate_role(self, value):
        if value == User.Role.ADMIN:
            raise serializers.ValidationError(
                "Admin registration is not allowed."
            )

        if value not in [
            User.Role.CUSTOMER,
            User.Role.ORGANIZER,
        ]:
            raise serializers.ValidationError(
                "Invalid role."
            )

        return value
    def create(self, validated_data):

        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data["email"],
            password=validated_data["password"],
            role=User.Role.CUSTOMER,
        )

        return user