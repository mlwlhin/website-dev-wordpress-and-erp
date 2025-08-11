document.addEventListener('DOMContentLoaded', () => {
    const togglesContainer = document.getElementById('pathway-toggles');
    const contentContainer = document.querySelector('.content-tabs-container');
    const contentBlocks = document.querySelectorAll('.content-block');

    if (!togglesContainer || !contentContainer || contentBlocks.length === 0) {
        console.error('Tab system error: A required element (toggles, container, or blocks) is missing. Check your HTML IDs and classes.');
        return;
    }

    const updateContainerHeight = (activeBlock) => {
        if (activeBlock) {
            contentContainer.style.height = `${activeBlock.scrollHeight}px`;
        }
    };
    
    const firstBlock = document.querySelector('.content-block');
    const firstButton = togglesContainer.querySelector('.pathway-btn');

    if (firstBlock) {
        firstBlock.classList.add('is-active');
        setTimeout(() => updateContainerHeight(firstBlock), 50); // Small delay for rendering
    }
    if (firstButton) {
        firstButton.classList.add('active-pathway');
    }

    togglesContainer.addEventListener('click', (e) => {
        const button = e.target.closest('.pathway-btn');
        if (button) {
            const targetId = button.dataset.target;
            const targetBlock = document.getElementById(targetId);

            if (!targetBlock) {
                console.error(`Tab error: Content block with ID "${targetId}" not found.`);
                return;
            }

            togglesContainer.querySelectorAll('.pathway-btn').forEach(btn => btn.classList.remove('active-pathway'));
            button.classList.add('active-pathway');
            
            contentBlocks.forEach(block => block.classList.remove('is-active'));
            targetBlock.classList.add('is-active');
            
            updateContainerHeight(targetBlock);
        }
    });

    window.addEventListener('resize', () => {
        const activeBlock = document.querySelector('.content-block.is-active');
        updateContainerHeight(activeBlock);
    });
});