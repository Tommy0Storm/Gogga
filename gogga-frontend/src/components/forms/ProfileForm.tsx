'use client'

/**
 * Profile Settings Form with useActionState
 * Demonstrates React 19 form handling with validation and pending states
 */

import { useActionState } from 'react'
import { Save, User, Mail, MapPin, Loader2, AlertCircle } from 'lucide-react'

interface ProfileFormState {
  message?: string
  errors?: {
    name?: string
    email?: string
    location?: string
  }
  success?: boolean
}

interface ProfileFormProps {
  initialData?: {
    name: string
    email: string
    location: string
  }
  onSave: (data: {
    name: string
    email: string
    location: string
  }) => Promise<ProfileFormState>
}

const initialState: ProfileFormState = {
  message: '',
  errors: {},
  success: false,
}

/**
 * Profile Form Component
 * Uses useActionState for validation, pending state, and error handling
 */
export function ProfileForm({ initialData, onSave }: ProfileFormProps) {
  const [state, formAction, pending] = useActionState(
    async (prevState: ProfileFormState, formData: FormData) => {
      const name = formData.get('name') as string
      const email = formData.get('email') as string
      const location = formData.get('location') as string

      // Call the save action
      return onSave({ name, email, location })
    },
    initialState
  )

  return (
    <form action={formAction} className="space-y-4">
      {/* Success/Error Message */}
      {state.message && (
        <div
          className={`p-3 rounded-lg flex items-center gap-2 text-sm ${
            state.success
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {state.success ? (
            <Save className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          <p>{state.message}</p>
        </div>
      )}

      {/* Name Field */}
      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Name
        </label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            id="name"
            name="name"
            defaultValue={initialData?.name}
            placeholder="Your name"
            aria-invalid={state.errors?.name ? 'true' : 'false'}
            aria-describedby={state.errors?.name ? 'name-error' : undefined}
            className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-300 focus:border-blue-300 ${
              state.errors?.name ? 'border-red-300 bg-red-50' : 'border-gray-200'
            }`}
          />
        </div>
        {state.errors?.name && (
          <p id="name-error" className="mt-1 text-sm text-red-600" role="alert">
            {state.errors.name}
          </p>
        )}
      </div>

      {/* Email Field */}
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Email
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="email"
            id="email"
            name="email"
            defaultValue={initialData?.email}
            placeholder="your.email@example.com"
            aria-invalid={state.errors?.email ? 'true' : 'false'}
            aria-describedby={state.errors?.email ? 'email-error' : undefined}
            className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-300 focus:border-blue-300 ${
              state.errors?.email ? 'border-red-300 bg-red-50' : 'border-gray-200'
            }`}
          />
        </div>
        {state.errors?.email && (
          <p id="email-error" className="mt-1 text-sm text-red-600" role="alert">
            {state.errors.email}
          </p>
        )}
      </div>

      {/* Location Field */}
      <div>
        <label
          htmlFor="location"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Location
        </label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            id="location"
            name="location"
            defaultValue={initialData?.location}
            placeholder="City, Country"
            aria-invalid={state.errors?.location ? 'true' : 'false'}
            aria-describedby={state.errors?.location ? 'location-error' : undefined}
            className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-300 focus:border-blue-300 ${
              state.errors?.location
                ? 'border-red-300 bg-red-50'
                : 'border-gray-200'
            }`}
          />
        </div>
        {state.errors?.location && (
          <p
            id="location-error"
            className="mt-1 text-sm text-red-600"
            role="alert"
          >
            {state.errors.location}
          </p>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={pending}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
      >
        {pending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Saving...</span>
          </>
        ) : (
          <>
            <Save className="w-4 h-4" />
            <span>Save Profile</span>
          </>
        )}
      </button>

      {/* Accessible status announcements */}
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {pending && 'Saving profile...'}
        {state.success && 'Profile saved successfully'}
        {state.errors && Object.keys(state.errors).length > 0 && 'Form has errors'}
      </div>
    </form>
  )
}

/**
 * Example Server Action for Profile Save
 * Would be in a separate file in production
 */
export async function saveProfile(data: {
  name: string
  email: string
  location: string
}): Promise<ProfileFormState> {
  'use server'

  // Simulate validation
  const errors: ProfileFormState['errors'] = {}

  if (!data.name || data.name.trim().length < 2) {
    errors.name = 'Name must be at least 2 characters'
  }

  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = 'Please enter a valid email address'
  }

  if (!data.location || data.location.trim().length < 2) {
    errors.location = 'Location must be at least 2 characters'
  }

  if (Object.keys(errors).length > 0) {
    return {
      message: 'Please fix the errors below',
      errors,
      success: false,
    }
  }

  // Simulate save delay
  await new Promise((resolve) => setTimeout(resolve, 1000))

  // In production, save to database here
  console.log('[saveProfile] Saving:', data)

  return {
    message: 'Profile saved successfully!',
    success: true,
  }
}
