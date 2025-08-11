document.addEventListener('DOMContentLoaded', function() {
    // Find the specific list item for 'Remember me'
    var rememberMeListItem = document.querySelector('li.choice-0.depth-1');

    // Find the 'Forgot Password' link that you manually added
    var forgotPasswordLink = document.querySelector('.forgot-password-link');

    if (rememberMeListItem && forgotPasswordLink) {
        // Create a new list item for the forgot password link
        var forgotPasswordListItem = document.createElement('li');
        forgotPasswordListItem.className = 'forgot-password-list-item';
        forgotPasswordListItem.appendChild(forgotPasswordLink);
        
        // Find the parent <ul> container
        var parentUl = rememberMeListItem.parentNode;
        
        // Append the new list item to the parent <ul>
        parentUl.appendChild(forgotPasswordListItem);

        // Apply Flexbox to the parent ul to align them side-by-side
        parentUl.style.display = 'flex';
        parentUl.style.justifyContent = 'space-between';
        parentUl.style.alignItems = 'center';
    }
});