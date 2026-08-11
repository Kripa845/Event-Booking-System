from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import User


class RegisterSerializer(serializers.ModelSerializer):
    password  = serializers.CharField(write_only=True, min_length=8)
    password2 = serializers.CharField(write_only=True, label="Confirm password")

    class Meta:
        model  = User
        fields = ["email", "username", "password", "password2", "role"]

    def validate_role(self, value):
        if value == User.Role.ADMIN:
            raise serializers.ValidationError("Admin registration is not allowed.")
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["password2"]:
            raise serializers.ValidationError({"password2": "Passwords do not match."})
        return attrs

    def create(self, validated_data):
        validated_data.pop("password2")
        role        = validated_data.get("role", User.Role.CUSTOMER)
        is_approved = role != User.Role.ORGANIZER   # organizers need admin approval
        return User.objects.create_user(
            email=validated_data["email"],
            username=validated_data.get("username", validated_data["email"].split("@")[0]),
            password=validated_data["password"],
            role=role,
            is_approved=is_approved,
        )


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model  = User
        fields = ["id", "username", "email", "role", "is_approved",
                  "phone", "bio", "avatar", "dob", "address"]
        read_only_fields = ["id", "email", "role", "is_approved"]


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Login with email + password. Blocks unapproved organizers."""

    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user
        if user.role == User.Role.ORGANIZER and not user.is_approved:
            raise serializers.ValidationError(
                "Your organizer account is pending admin approval."
            )
        # Attach user info to token response
        data["user"] = {
            "id":       user.id,
            "email":    user.email,
            "username": user.username,
            "role":     user.role,
        }
        return data
