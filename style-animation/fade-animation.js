document.addEventListener('DOMContentLoaded', function() {
    // Select all parent containers that act as an animation group
    // Make sure to add the class 'animation-group' to the parent container (e.g., Columns block)
    const animationGroups = document.querySelectorAll('.animation-group');

    // Options for the Intersection Observer
    const observerOptions = {
        root: null, // Use the viewport as the root
        rootMargin: '0px', // No margin around the root
        threshold: 0.2 // Trigger when 20% of the group container is visible
    };

    // Create an Intersection Observer instance
    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            // If the group container is intersecting (visible)
            if (entry.isIntersecting) {
                const group = entry.target;
                // Find all individual animated items within this specific group
                const animatedItemsInGroup = group.querySelectorAll('.animated-item');

                animatedItemsInGroup.forEach((item, index) => {
                    // Apply a staggered delay to each item within this group
                    // Adjust '200' to change the delay increment between items
                    item.style.transitionDelay = `${index * 200}ms`;
                    // Add the 'is-visible' class to trigger the animation
                    item.classList.add('is-visible');
                });

                // Stop observing this group once its items have animated
                observer.unobserve(group);
            }
        });
    }, observerOptions);

    // Start observing each animation group
    animationGroups.forEach(group => {
        observer.observe(group);
    });
});