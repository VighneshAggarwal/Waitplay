import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import socket from './socket';  // Move up one directory
import './ItemPage.css';

const ItemsPage = () => {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [cart, setCart] = useState([]);
    const [items, setItems] = useState([]);
    const [cartItems, setCartItems] = useState([]);
    const [cartID, setCartID] = useState(null);
    const [isCartModalOpen, setCartModalOpen] = useState(false);
    const [inputCartID, setInputCartID] = useState('');
    const [quantityState, setQuantityState] = useState({});
    const [showOrderSummary, setShowOrderSummary] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [isManualScroll, setIsManualScroll] = useState(false);
    const [activeFilters, setActiveFilters] = useState(['All']); // Default to "All" selected
    const [isFocused, setIsFocused] = useState(false); // Track input focus
    const [isTyping, setIsTyping] = useState(false); // Track user typing
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPlaceholder, setCurrentPlaceholder] = useState('Search');
    const [index, setIndex] = useState(0);
    const bannerRef = useRef(null);
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const type = queryParams.get('category') || 'all';
    const category = queryParams.get('category');
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const navigate = useNavigate();
    const handlePlayOrder = () => {
        if (cart.length > 0) {
            navigate('/waitplay'); // Adjust the route path if needed
        } else {
            alert('Your cart is empty. Add items to play the order.');
        }
    };

    const [userID] = useState(() => {
        const storedID = localStorage.getItem("userID");
        if (storedID) return storedID;
    
        const newID = Math.random().toString(36).substring(2, 10);
        localStorage.setItem("userID", newID);
        return newID;
    });

    useEffect(() => {
        if (!cartID || !userID) return;
    
        socket.emit("join-cart", {cartID, userID});
        console.log(`abcd User ${userID} joined the cart ${cartID}`);
        console.log(cart); // Log the cart to debug
    
        // Listen for updates
        socket.on("update-cart", (data) => {
            console.log("Received cart update event:", data);
    
            if (data.action === "add") {
                console.log("aaaaaa" ,data.items);
                setCart(data.items); // Add new item
            // } else if (data.action === "remove") {
            //     setCart((prev) => prev.filter(item => item.id !== data.itemID)); // Remove item
            }
    
            if (Array.isArray(data.items)) {
                setCart(data.items); // Update with the correct array
            } else {
                console.error("Received data is not an array:", data.items);
            }
        });
    
        return () => {
            socket.off("update-cart"); // Cleanup
        };
    }, [cartID, userID, cart]);    

    useEffect(() => {
        axios
          .get(`http://localhost:5001/products?type=${type}`)
          .then((response) => setProducts(response.data))
          .catch((error) => console.error('Error fetching products:', error));
      }, [type]);

    useEffect(() => {
        const fetchProductsAndCategories = async () => {
            try {
                const params = new URLSearchParams();
                if (type && type !== 'all') params.append('type', type.toLowerCase());
                if (category && category !== 'all') params.append('category', category.toLowerCase());
    
                const categoryResponse = await axios.get(`http://localhost:5001/categories?type=${type}`);
                setCategories(categoryResponse.data);
            } catch (error) {
                console.error('Error fetching data:', error);
            }
        };
    
        fetchProductsAndCategories();
    }, [type, category]);

    useEffect(() => {
        if (searchQuery.trim() !== '') {
            axios
                .get(`http://localhost:5001/api/search?q=${searchQuery}`)
                .then((response) => setProducts(response.data))
                .catch((error) => console.error('Error fetching search results:', error));
        } else {
            axios
                .get(`http://localhost:5001/products?type=${type}`)
                .then((response) => setProducts(response.data))
                .catch((error) => console.error('Error fetching products:', error));
        }
    }, [searchQuery, type]);

    useEffect(() => {
        let interval;

        if (!isManualScroll) {
            interval = setInterval(() => {
                if (bannerRef.current) {
                    const banners = Array.from(bannerRef.current.children);
                    const firstChild = banners.shift();
                    bannerRef.current.appendChild(firstChild);
                }
            }, 3000);
        }

        return () => clearInterval(interval);
    }, [isManualScroll]);

    useEffect(() => {
        let interval;
    
        if (!isFocused && !isTyping && searchQuery.trim() === '') {
            interval = setInterval(() => {
                const randomIndex = Math.floor(Math.random() * products.length);
                const randomProduct = products[randomIndex]?.title || '...';
                setCurrentPlaceholder(`Search ${randomProduct}`);
            }, 5000); // Rotate every 5 seconds
        }
    
        return () => clearInterval(interval); // Cleanup on unmount
    }, [isFocused, isTyping, searchQuery, products]);
    

    useEffect(() => {
        // Update the placeholder text every 5 seconds
        const interval = setInterval(() => {
          const nextIndex = (index + 1) % products.length; // Loop through products
          setIndex(nextIndex);
          setCurrentPlaceholder(`Search ${products[nextIndex]?.title || '...'}`);
        }, 5000); // Change every 5 seconds
      
        return () => clearInterval(interval); // Cleanup on unmount
      }, [index, products]); 
      
      useEffect(() => {
        const handleCartUpdate = (updatedItems) => {
            console.log("Received cart update from WebSocket:", updatedItems);
    
            if (!Array.isArray(updatedItems.items)) {
                console.log("updatedItems type: ", typeof updatedItems);
                console.error("Expected an array but received:", updatedItems);
                return;
            }
    
            // Remove duplicate items before updating state
            const uniqueItems = [...new Set(updatedItems.items.map(item => JSON.stringify(item)))]
                .map(str => JSON.parse(str));
    
            console.log("Filtered items:", uniqueItems);
            setCartItems(uniqueItems);
        };
    
        socket.on("cartUpdated", handleCartUpdate);
    
        // Cleanup function to prevent multiple listeners
        return () => {
            socket.off("cartUpdated", handleCartUpdate);
        };
    }, []);

    // Function to open the "Share & Join Cart" modal
    const openCartModal = () => {
        setCartModalOpen(true);
    };

    // Function to close the modal
    const closeCartModal = () => {
        setCartModalOpen(false);
    };

    const handleCreateCart = async () => {
        try {
            const response = await axios.post("http://localhost:5001/create-cart");
            setCartID(response.data.cartID);
            socket.emit("joinCart", response.data.cartID); // Join WebSocket room
        } catch (error) {
            console.error("Error creating cart:", error);
        }
    };

    // const [products, setProducts] = useState({});
    const [newItems, setnewItems] = useState();

    useEffect(() => {
        if (!Array.isArray(cartItems) || cartItems.length === 0) return;
    
        const fetchProducts = async () => {
            try {
                const newProducts = {};
                const promises = [];
    
                for (const item of cartItems) {
                    const item_id = item.item; // Extract item ID
    
                    // Push the fetch request into an array (not waiting here)
                    const fetchPromise = fetch(`http://localhost:5001/product/${item_id}`)
                        .then(response => {
                            if (!response.ok) throw new Error(`Failed to fetch product ${item_id}`);
                            return response.json();
                        })
                        .then(data => {
                            newProducts[item_id] = {
                                ...data,
                                newQuantity: item.quantity ?? 1, // Attach quantity from cartItems
                            };
                        })
                        .catch(error => {
                            console.error("Error fetching product:", error);
                        });
    
                    promises.push(fetchPromise);
                }
    
                // Wait for all fetches to complete
                await Promise.all(promises);
    
                console.log("Fetched Products:", newProducts);
                setnewItems(newProducts);
            } catch (error) {
                console.error("Error fetching products:", error);
            }
        };
    
        fetchProducts();
    }, [cartItems]);       
    
    // Function to Join an Existing Cart
    const handleJoinCart = async () => {
        if (!inputCartID) return alert('Please enter a Cart ID');
        try {
            const response = await axios.post("http://localhost:5001/join-cart", { cartID: inputCartID });
            setCartID(inputCartID);
            setItems(response.data.items);
            socket.emit("joinCart", inputCartID); // Join WebSocket room
        } catch (error) {
            console.error("Error joining cart:", error);
        }
    };

    // Handle adding items
    const addItem = (item) => {
        if (cartID) {
            socket.emit("add-item", { cartID, userID, item });
        }
    };  

    // Handle removing items
    const removeItem = (itemID) => {
        if (cartID) {
            socket.emit("remove-item", { cartID, itemID });
        }
    };

    const [datai ,setDatai] = useState();

    const handleManualScroll = () => {
        setIsManualScroll(true);
        setTimeout(() => setIsManualScroll(false), 10000);
    };

    const handleFocus = () => setIsFocused(true);

    const handleBlur = () => {
        setIsFocused(false);
        if (searchQuery.trim() === '') {
            setIsTyping(false); // Reset typing state if input is empty
        }
    };

    const handleChange = (e) => {
        const value = e.target.value;
        setSearchQuery(value);
        setIsTyping(value.trim() !== ''); // If input is not empty, set isTyping to true
    };

    const[totalQuantity,setTotalQuantity] = useState(0);

    const calculateTotalQuantity = (items) => {
        if (!items || typeof items !== "object") return 0;
        return Object.keys(items).length; // Count the number of keys (objects)
    };
    

    useEffect(() => {
        console.log("jahdjahsd", calculateTotalQuantity(newItems));
        setTotalQuantity(calculateTotalQuantity(newItems));
    }, [newItems]);
    // Function to Add/Remove Items in Cart
    const handleQuantityChange = (productId, type, delta, title, price) => {
        if (!productId || !type) {
            console.error("Invalid productId or type:", { productId, type });
            return;
        }
    
        setCart((prevCart) => {
            const key = `${productId}-${type}`;
            const existingProduct = prevCart.find((item) => item._id === productId && item.type === type);
            let newCart;
    
            if (existingProduct) {
                const newQuantity = Math.max(existingProduct.quantity + delta, 0);
    
                if (newQuantity === 0) {
                    newCart = prevCart.filter((item) => !(item._id === productId && item.type === type));
                    removeItem(productId);
                } else {
                    newCart = prevCart.map((item) =>
                        item._id === productId && item.type === type
                            ? { ...item, quantity: newQuantity }
                            : item
                    );
                    if(delta>0){
                        addItem(productId);
                    }
                    else{
                        removeItem(productId);
                    }
                }
            } else {
                const product = products.find((prod) => prod._id === productId);
                if (!product) {
                    console.error("Product not found:", productId);
                    return prevCart;
                }
    
                newCart = [
                    ...prevCart,
                    {
                        _id: productId,
                        title: title || product.title,
                        type,
                        price: price || (type === "Half" ? product.halfPrice : product.fullPrice),
                        quantity: 1,
                    },
                ];
                addItem(productId);
            }
    
            // Always emit WebSocket update whenever quantity changes
            if (cartID) {
                const updatedItem = newCart.find((i) => i._id === productId && i.type === type);
                socket.emit("update-cart", {
                    cartID,
                    item: updatedItem
                        ? {
                              _id: updatedItem._id,
                              title: updatedItem.title || "Unknown",  // Ensure title is present
                              type: updatedItem.type,
                              price: updatedItem.price || 0,  // Ensure price is present
                              quantity: updatedItem.quantity,
                          }
                        : { productId, type, quantity: 0 }, // Ensure removal is also sent
                });
                
                console.log("Emitting update-cart:", updatedItem);

                // Log for debugging
                console.log(`WebSocket Event: update-cart`, {
                    cartID,
                    item: updatedItem || { productId, type, quantity: 0 },
                });
            }
    
            setQuantityState((prevState) => ({
                ...prevState,
                [key]: newCart.find((i) => i._id === productId && i.type === type)?.quantity || 0,
            }));
    
            return newCart;
        });
    };    
    

    const toggleOrderSummary = () => {
        setShowOrderSummary(!showOrderSummary);
    };

    const showProductDetails = (product) => {
        setSelectedProduct(product);
    };

    const closeProductDetails = () => {
        setSelectedProduct(null);
    };

    const handleFilter = (filter) => {
        if (filter === 'All') {
            setActiveFilters((prevFilters) => 
                prevFilters.includes('All') && prevFilters.length === categories.length + 1
                    ? [] // Deselect all
                    : ['All', ...categories] // Select all
            );
        } else {
            setActiveFilters((prevFilters) => {
                if (prevFilters.includes(filter)) {
                    const updatedFilters = prevFilters.filter((f) => f !== filter);
                    return updatedFilters.length === 0 ? ['All'] : updatedFilters;
                } else {
                    return [...prevFilters.filter((f) => f !== 'All'), filter];
                }
            });
        }
    };

    const filteredProducts = activeFilters.includes('All')
    ? products
    : products.filter((product) => activeFilters.includes(product.category));

    return (
        <div className="app-container">
            <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', background: '#fff', boxShadow: '0px 1px 5px rgba(0, 0, 0, 0.1)' }}>
    {/* Logo Section */}
    <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft:"4%" }}>
        <img
            src="https://via.placeholder.com/40"
            alt="Logo"
            style={{ width: '40px', height: '40px', borderRadius: '5px' }}
        />
        <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#333' }}>Logo</span>
    </div>

    {/* Share or Join Cart Button */}
    <button
    onClick={openCartModal}
        style={{
            background: 'linear-gradient(to right, #f54ea2, #ff7676)',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '20px',
            color: '#fff',
            fontSize: '14px',
            cursor: 'pointer',
            fontWeight: 'bold',
            paddingRight: "4%",
            marginRight:"3%",
        }}
    >
        Share or Join Cart
    </button>
</header>
{/*  Cart Modal */}
{isCartModalOpen && (
                <div className="modal">
                    <div className="modal-content">
                        <h2>Share or Join Cart</h2>
                        {!cartID ? (
                            <>
                                <button onClick={handleCreateCart}>Create & Share Cart</button>
                                <hr />
                                <input
                                    type="text"
                                    placeholder="Enter Cart ID"
                                    value={inputCartID}
                                    onChange={(e) => setInputCartID(e.target.value)}
                                />
                                <button onClick={handleJoinCart}>Join Cart</button>
                            </>
                        ) : (
                            <p>Your Cart ID: <strong>{cartID}</strong></p>
                        )}
                        <button onClick={closeCartModal}>Close</button>
                    </div>
                </div>
            )}


<div className="search-and-call" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', background: '#000', color: '#fff', marginTop: '-1px', width:"100%" }}>
    {/* Search Bar */}
    <div className="search-bar" style={{ display: 'flex', alignItems: 'center', background: '#fff', borderRadius: '10px', padding: '5px 10px', width: '75%', marginLeft: "2%" }}>
        <input
            type="text"
            placeholder={isFocused || isTyping ? '' : currentPlaceholder} // Show animation or user input
            value={searchQuery}
            onFocus={handleFocus} // Stop animation when focused
            onBlur={handleBlur} // Resume animation if empty on blur
            onChange={handleChange} // Handle typing
            style={{
                border: 'none',
                outline: 'none',
                flexGrow: 1,
                padding: '10px',
                fontSize: '14px',
                borderRadius: '5px',
            }}
        />
        <img
            src="https://s3-alpha-sig.figma.com/img/ae40/6128/f3012b96902d816d28e1503545a493ed?Expires=1737331200&Key-Pair-Id=APKAQ4GOSFWCVNEHN3O4&Signature=XrLLwUzf5QcUUbG3O-NxCw4f~35asIgdZe~lqE~xF5u3N7Bw7ezAp43p5j2gMHuc0rTStuVYalBYNjBTH5jUi~D6EXXXhhMgdbybSKr29j4a1ij1PWErqa136o1WOkFpBwysyc0pvtfGAkNcxPUMBon8upK-lva~mtkpz37fHg~L8uCPDoWOjv2XK-ItCgVcOD4NR7YAiT2am8ScyGw6R5dLHsvMCcgKzS-kqlCK5jgds17MHB8Ro2TrWYGp5uAB56~2gle0g9g5u7jUUfsBFxNzNI~4IHPl0Zx~IObkmprORe8YLtN6Ze5MZQa2kV01~pdEx4zxn~JHUXO0jFkocg__"
            alt="Search Icon"
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
        />
    </div>



    {/* Call Waiter Button */}
    <button
        style={{
            background: '#8e44ad',
            // border: 'none',
            position:'relative',
            right:"2%",
            padding: '10px 10px',
            borderRadius: '10px',
            color: '#fff',
            fontSize: '15px',
            cursor: 'pointer',
            fontWeight: 'bold',
            marginLeft: '15px',
            whiteSpace: 'nowrap',
        }}
    >Call Waiter
    </button>
</div>


            <div className="banner-container" onTouchStart={handleManualScroll} onMouseDown={handleManualScroll}>
                <div className="banner-carousel" ref={bannerRef}>
                    <div className="banner-item">
                        <img src="https://content.wepik.com/statics/740676612/preview-page0.jpg" alt="Banner 1" className="banner-image" />
                    </div>
                    <div className="banner-item">
                        <img src="https://img.freepik.com/free-vector/flat-design-food-sale-background_23-2149211006.jpg?w=360" alt="Banner 2" className="banner-image" />
                    </div>
                    <div className="banner-item">
                        <img src="https://img.freepik.com/free-vector/flat-design-food-sale-background_23-2149167390.jpg" alt="Banner 3" className="banner-image" />
                    </div>
                </div>
            </div>

            <div className="filter-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '10px', marginLeft: '0', paddingLeft: '0', width: '90%' }}>
    <div className="dropdown" style={{ position: 'relative', marginRight: '30px' }}>
        <div
            className="selected-category"
            style={{
                fontSize: '18px',
                fontWeight: 'bold',
                color: type === 'veg' ? 'green' : type === 'non-veg' ? 'red' : type === 'drinks' ? 'blue' : 'purple',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                cursor: 'pointer',
            }}
            onClick={() => setDropdownOpen((prev) => !prev)}
        >
            <span
                style={{
                    display: 'inline-block',
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: type === 'veg' ? 'green' : type === 'non-veg' ? 'red' : type === 'drinks' ? 'blue' : 'purple',
                }}
            ></span>
            {type.charAt(0).toUpperCase() + type.slice(1)}
        </div>
        {dropdownOpen && (
            <ul
                className="dropdown-menu"
                style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    backgroundColor: 'white',
                    border: '1px solid #ccc',
                    boxShadow: '0 2px 5px rgba(0, 0, 0, 0.1)',
                    zIndex: 1000,
                    listStyle: 'none',
                    padding: '10px 0',
                    margin: 0,
                    width: '150px',
                }}
            >
                {["veg", "non-veg", "drinks", "icecream"]
                    .filter((category) => category.toLowerCase() !== type.toLowerCase())
                    .map((category) => (
                        <li
                            key={category}
                            style={{
                                padding: '5px 15px',
                                cursor: 'pointer',
                                color: category === 'non-veg' ? 'red' : category === 'drinks' ? 'blue' : category === 'icecream' ? 'purple' : 'green',
                            }}
                            onClick={() => {
                                navigate(`/items?category=${category.toLowerCase()}`);
                                setDropdownOpen(false);
                            }}
                        >
                            {category.charAt(0).toUpperCase() + category.slice(1)}
                        </li>
                    ))}
            </ul>
        )}
    </div>
    <div style={{ display: 'flex', overflowX: 'scroll', gap: '10px', flexGrow: 1 }}>
        <button
            className={`filter-button ${activeFilters.includes('All') ? 'active' : ''}`}
            onClick={() => handleFilter('All')}
        >
            All
        </button>
        {categories.map((category) => (
            <button
                key={category}
                className={`filter-button ${activeFilters.includes(category) ? 'active' : ''}`}
                onClick={() => handleFilter(category)}
            >
                {category}
            </button>
        ))}
    </div>
</div>

{/* </div> */}

<main className="product-list">
    {filteredProducts.map((product) => {
        const halfKey = `${product._id}-Half`;
        const fullKey = `${product._id}-Full`;

        return (
            <div className="product-card" key={product._id}>
                <div className="product-image-container" style={{ width: '200px', height: '200px' }}>
                    <img
                        className="product-image"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        src={product.image}
                        alt={product.title}
                    />
                </div>
                <div className="product-details">
                    <div className="product-header">
                        <h3 className="product-title">{product.title}</h3>
                        <span className="product-time">20min</span>
                    </div>
                    <p className="product-description">
                        {product.description} <span className="know-more" onClick={() => showProductDetails(product)}>...more</span>
                    </p>
                    <div className="product-prices">
                        <span className="price">@{product.halfPrice} Half</span>
                        <span className="price">@{product.fullPrice} Full</span>
                    </div>

                    {/* Quantity Controls (Now using WebSocket) */}
                    <div className="product-actions">
                        <div
                            className="quantity-control"
                            style={{
                                backgroundColor: quantityState[halfKey] > 0 ? 'rgba(255, 182, 193, 0.8)' : '#f9f9f9',
                                border: quantityState[halfKey] > 0 ? '1px solid #ff6f61' : '1px solid #ddd',
                            }}
                        >
                            <span>Half</span>
                            <button onClick={() => handleQuantityChange(product._id, 'Half', -1, product.title, product.halfPrice)}>-</button>
                            <span>{quantityState[halfKey] || 0}</span>
                            <button onClick={() => handleQuantityChange(product._id, 'Half', 1, product.title, product.halfPrice)}>+</button>
                        </div>

                        <div
                            className="quantity-control"
                            style={{
                                backgroundColor: quantityState[fullKey] > 0 ? 'rgba(173, 216, 230, 0.8)' : '#f9f9f9',
                                border: quantityState[fullKey] > 0 ? '1px solid #61a6ff' : '1px solid #ddd',
                            }}
                        >
                            <span>Full</span>
                            <button onClick={() => handleQuantityChange(product._id, 'Full', -1, product.title, product.fullPrice)}>-</button>
                            <span>{quantityState[fullKey] || 0}</span>
                            <button onClick={() => handleQuantityChange(product._id, 'Full', 1, product.title, product.fullPrice)}>+</button>
                        </div>
                    </div>

                    {/*  Note to Chef */}
                    <textarea
                        className="notes-input"
                        style={{
                            backgroundColor: cart.find(item => item.productId === product._id) ? 'rgba(240, 248, 255, 0.5)' : '#fff',
                            border: '1px solid #ddd',
                            width: '100%',
                            marginTop: '10px',
                            padding: '10px',
                            borderRadius: '5px',
                        }}
                        placeholder="Note to chef"
                    ></textarea>
                </div>
            </div>
        );
    })}
</main>


            {selectedProduct && (
                <div className="popup-overlay">
                    <div className="product-details-popup slide-up">
                        <button onClick={closeProductDetails} className="close-kmore">X</button>
                        <img className="details-image" src={selectedProduct.image} alt={selectedProduct.title} />
                        <div className="details-content">
                            <h3>{selectedProduct.title}</h3>
                            <p className="details-description">{selectedProduct.detailedDescription}</p>
                            <div className="special-items">
                                <h4>Add Special Items</h4>
                                {selectedProduct.specialItems.map((item, index) => (
                                    <button key={index} className="special-item-button">{item}</button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

<footer className="cart-footer">
                <div className="cart-container">
                    <img
                        src="https://i.pinimg.com/originals/e2/06/3e/e2063ef31174bff0e81d1bb641b5f3f3.png" 
                        alt="Cart"
                        className="cart-icon"
                    />
                    <span className="cart-badge">{totalQuantity}</span>
                </div>
                <button onClick={toggleOrderSummary} className="summary-button">Order Summary ></button>
                <button
                    className="place-order"
                    style={{
                        backgroundColor: cart.length === 0 ? 'grey' : 'darkgreen',
                        color: 'white',
                    }}
                    onClick={handlePlayOrder}
                >
                    Play Order
                </button>
            </footer>

            {showOrderSummary && (
                <div className="order-summary-container">
                    <div className="order-summary slide-up">
                        <div className="order-summary-header">
                            <div className="cart-container">
                                <div className= "new-cart">
                                    <img
                                        src="https://i.pinimg.com/originals/e2/06/3e/e2063ef31174bff0e81d1bb641b5f3f3.png" 
                                        alt="Cart"
                                        className="cart-icon"
                                    />
                                    <span className="cart-badge">{cart.reduce((total, item) => total + item.quantity, 0)}</span>
                                </div>
                            </div>
                            <div className="summary-text">Order Summary </div>
                            <button onClick={toggleOrderSummary} className="close-summary">X</button>
                        </div>
                        <table>
                            <thead>
                                <tr>
                                    <th>User</th>
                                    <th>Item</th>
                                    <th>Quantity</th>
                                    <th>Price</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(
                                    cartItems.reduce((acc, { item, userID }) => {
                                        if (!acc[userID]) {
                                            acc[userID] = [];
                                        }
                                        acc[userID].push(item);
                                        return acc;
                                    }, {})
                                ).map(([userID, items]) => (
                                    <React.Fragment key={userID}>
                                        <tr>
                                            <td colSpan="4">
                                                <strong>User: {userID}</strong>
                                            </td>
                                        </tr>
                                        {items.map((item_id, index) => (
                                            newItems[item_id] ? (
                                                <tr key={`${userID}-${item_id}`}>
                                                    <td></td> {/* Empty cell for spacing */}
                                                    <td>{index + 1}. {newItems[item_id].title} ({newItems[item_id].type})</td>
                                                    <td>{newItems[item_id].newQuantity ?? "N/A"}</td>
                                                    <td>₹{newItems[item_id].fullPrice}</td>
                                                </tr>
                                            ) : (
                                                <tr key={`${userID}-${item_id}-loading`}>
                                                    <td colSpan="4">Loading product details...</td>
                                                </tr>
                                            )
                                        ))}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <button
                        className="place-order cart"
                        style={{
                            backgroundColor: cart.length === 0 ? 'grey' : 'darkgreen',
                            color: 'white',
                        }}
                        onClick={handlePlayOrder}
                    >
                        Play Order
                    </button>
                </div>
            )}
            
        </div>
    );
};

export default ItemsPage;